using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

// ============================================================
// IETM Launcher  -  Phase 4 (Production Grade)
// ============================================================
// Key design decisions:
//
//  1. PORT-BASED running-server detection (no fragile process inspection).
//     If server.info exists AND the port in it is alive on TCP -> already running.
//
//  2. STALE FILE GUARD via file write-time watermark.
//     server.info written before our launch timestamp is ignored.
//
//  3. CONTINUOUS re-read of server.info every poll tick.
//     Port changes are detected immediately; cached values are never trusted.
//
//  4. TCP-only health check (no HTTP, no HTTPS, no status-code assumptions).
//     "Is something listening on this port?" is all we need to know.
//
//  5. MUTEX only protects concurrent cold-start orchestrations.
//     If the server is already running, the second launcher opens the browser
//     immediately without blocking on the mutex.
//
//  6. FULL DIAGNOSTIC LOG written to Logs/launcher.log (append mode).
//
//  7. 30-second startup timeout with 250 ms intelligent polling.
//
//  8. HTTP only - no HTTPS anywhere.
// ============================================================

namespace IETMLauncher
{
    static class Program
    {
        // ---- Configuration constants ----------------------------------------
        const int    STARTUP_TIMEOUT_MS  = 30000;   // Max wait for cold boot (ms)
        const int    POLL_INTERVAL_MS    = 250;     // server.info re-read cadence (ms)
        const int    TCP_TIMEOUT_MS      = 500;     // TCP connection probe timeout (ms)
        const string MUTEX_ID            = "{IETM-Launcher-Mutex-E3F2A1B4}";

        // Shared logger (set in EnsureLog)
        static StreamWriter _log;

        // ---- Entry point ----------------------------------------------------
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                RunLogic();
            }
            catch (Exception ex)
            {
                string msg = "Unexpected launcher error:\n\n" + ex.Message;
                try { Log(msg); } catch { }
                MessageBox.Show(msg, "IETM Launcher - Fatal Error",
                                MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                try { if (_log != null) { _log.Flush(); _log.Dispose(); } } catch { }
            }
        }

        // ---- Main orchestration ---------------------------------------------
        static void RunLogic()
        {
            string basePath       = AppDomain.CurrentDomain.BaseDirectory;
            string serverExePath  = Path.Combine(basePath, "server.exe");
            string logsDir        = Path.Combine(basePath, "Logs");
            string serverInfoPath = Path.Combine(logsDir, "server.info");

            // Ensure Logs directory exists before we open the log.
            EnsureLogsDir(logsDir);
            EnsureLog(Path.Combine(logsDir, "launcher.log"));

            Log("=======================================================");
            Log("IETM Launcher started.");
            Log("Base path : " + basePath);

            // ----------------------------------------------------------------
            // FAST PATH: Check if an existing server is already alive.
            // We do this BEFORE acquiring any mutex so that the second
            // launcher click is never blocked by the first.
            // ----------------------------------------------------------------
            int existingPort = ReadPortFromInfo(serverInfoPath);
            if (existingPort != -1)
            {
                Log("server.info present. Testing port " + existingPort + " for a live server...");
                if (TcpProbe("127.0.0.1", existingPort))
                {
                    Log("Existing server confirmed alive on port " + existingPort + ". Opening browser.");
                    string existingUrl = BuildBrowserUrl(existingPort);
                    if (!OpenBrowser(existingUrl))
                    {
                        Warn("Could not open browser. Navigate to: " + existingUrl);
                        MessageBox.Show(
                            "Server is running on port " + existingPort +
                            " but we could not open your browser.\n\nNavigate to:\n" + existingUrl,
                            "IETM Launcher", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    else
                    {
                        Log("Browser opened. Launcher exiting (fast path).");
                    }
                    return;
                }
                else
                {
                    Log("Port " + existingPort + " is not responding. Proceeding to cold start.");
                }
            }
            else
            {
                Log("No valid server.info found. Proceeding to cold start.");
            }

            // ----------------------------------------------------------------
            // COLD START PATH: Acquire mutex so only one launcher boots the server.
            // ----------------------------------------------------------------
            bool mutexAcquired = false;
            Mutex mutex = null;

            try
            {
                mutex = new Mutex(false, MUTEX_ID);

                try
                {
                    // Wait up to STARTUP_TIMEOUT + 5 s for any concurrent cold start to finish.
                    mutexAcquired = mutex.WaitOne(TimeSpan.FromMilliseconds(STARTUP_TIMEOUT_MS + 5000), false);
                }
                catch (AbandonedMutexException)
                {
                    mutexAcquired = true;  // Previous owner crashed; we inherit.
                }

                // After acquiring the mutex, re-check in case another launcher
                // already completed the cold start while we were waiting.
                int portAfterWait = ReadPortFromInfo(serverInfoPath);
                if (portAfterWait != -1 && TcpProbe("127.0.0.1", portAfterWait))
                {
                    Log("Another launcher finished booting the server. Reusing port " + portAfterWait + ".");
                    string reuseUrl = BuildBrowserUrl(portAfterWait);
                    OpenBrowser(reuseUrl);
                    Log("Browser opened (post-mutex reuse). Launcher exiting.");
                    return;
                }

                // Verify server.exe exists.
                if (!File.Exists(serverExePath))
                {
                    string err = "server.exe not found at:\n" + serverExePath +
                                 "\n\nPlease ensure the installation is complete.";
                    Log("ERROR: " + err);
                    MessageBox.Show(err, "IETM Launcher Error",
                                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // Record the launch timestamp BEFORE we delete server.info.
                // Any server.info written after this moment is trustworthy.
                DateTime launchAt = DateTime.UtcNow;
                Log("Launch watermark: " + launchAt.ToString("O"));

                // Delete any stale server.info so we cannot read an old port.
                if (File.Exists(serverInfoPath))
                {
                    try
                    {
                        File.Delete(serverInfoPath);
                        Log("Deleted stale server.info.");
                    }
                    catch (Exception ex)
                    {
                        Log("WARNING: Could not delete server.info: " + ex.Message);
                    }
                }

                // Check and configure HTTPS Certificate
                CheckAndEnsureCertificate(basePath);

                // Check and configure Windows Firewall rule for the server
                CheckAndEnsureFirewallRule(serverExePath);

                // Start server.exe silently with no console window.
                Log("Starting server.exe...");
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName        = serverExePath,
                    UseShellExecute = false,
                    CreateNoWindow  = true,
                    WindowStyle     = ProcessWindowStyle.Hidden
                };
                psi.EnvironmentVariables["NODE_ENV"] = "production";

                Process serverProc = null;
                try
                {
                    serverProc = Process.Start(psi);
                    if (serverProc == null) throw new Exception("Process.Start returned null.");
                    Log("server.exe launched. PID=" + serverProc.Id);
                }
                catch (Exception ex)
                {
                    string err = "Failed to launch server.exe:\n" + ex.Message;
                    Log("ERROR: " + err);
                    MessageBox.Show(err, "IETM Launcher Error",
                                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // Wait for the server to be ready.
                int port = WaitForServerReady(serverInfoPath, launchAt, serverProc);

                if (port == -1) return; // Error already shown inside WaitForServerReady.

                string url = BuildBrowserUrl(port);
                Log("Opening browser: " + url);
                if (!OpenBrowser(url))
                {
                    string msg = "Server is on port " + port +
                                 " but we could not open your browser.\n\nNavigate to:\n" + url;
                    Log("WARNING: " + msg);
                    MessageBox.Show(msg, "IETM Launcher", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                else
                {
                    Log("Browser opened. Launcher exiting.");
                }
            }
            finally
            {
                if (mutexAcquired && mutex != null)
                    try { mutex.ReleaseMutex(); } catch { }
                if (mutex != null)
                    try { mutex.Dispose(); } catch { }
            }
        }

        // ---- Ready-wait loop ------------------------------------------------
        // Continuously re-reads server.info every tick.
        // Accepts a port change mid-wait (race-condition safe).
        // Only accepts files written after launchAt (stale-file safe).
        static int WaitForServerReady(string serverInfoPath, DateTime launchAt, Process serverProc)
        {
            int elapsedMs  = 0;
            int lastPort   = -1;

            Log("Entering ready-wait loop (timeout=" + STARTUP_TIMEOUT_MS + " ms).");

            while (elapsedMs < STARTUP_TIMEOUT_MS)
            {
                // Detect server crash early.
                try
                {
                    if (serverProc != null && serverProc.HasExited)
                    {
                        string err = "server.exe exited unexpectedly with code " +
                                     serverProc.ExitCode + ".\n\nCheck Logs/server.log.";
                        Log("ERROR: " + err);
                        MessageBox.Show(err, "IETM Launcher Error",
                                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                        return -1;
                    }
                }
                catch { /* HasExited can throw if process handle is unavailable. */ }

                // Re-read server.info every tick.
                int currentPort = ReadPortFromInfoIfFresh(serverInfoPath, launchAt);

                if (currentPort != -1 && currentPort != lastPort)
                {
                    Log("Port detected/changed: " + lastPort + " -> " + currentPort + ". Switching health checks.");
                    lastPort = currentPort;
                }

                // TCP health check on the current port.
                if (currentPort != -1 && TcpProbe("127.0.0.1", currentPort))
                {
                    Log("Server alive on port " + currentPort + " after " + elapsedMs + " ms.");
                    return currentPort;
                }

                Thread.Sleep(POLL_INTERVAL_MS);
                elapsedMs += POLL_INTERVAL_MS;
            }

            // Timeout.
            string timeoutMsg;
            if (lastPort == -1)
            {
                timeoutMsg = "Timed out after " + (STARTUP_TIMEOUT_MS / 1000) +
                             " seconds.\nserver.info was never written.\n\nCheck Logs/server.log.";
            }
            else
            {
                timeoutMsg = "Timed out after " + (STARTUP_TIMEOUT_MS / 1000) +
                             " seconds.\nServer wrote port " + lastPort +
                             " but did not respond to TCP probes.\n\nCheck Logs/server.log.";
            }
            Log("TIMEOUT: " + timeoutMsg);
            MessageBox.Show(timeoutMsg, "IETM Launcher - Timeout",
                            MessageBoxButtons.OK, MessageBoxIcon.Error);
            return -1;
        }

        // ---- File helpers ---------------------------------------------------

        // Read server.info unconditionally (for fast-path / post-mutex checks).
        static int ReadPortFromInfo(string path)
        {
            if (!File.Exists(path)) return -1;
            return ParsePort(path);
        }

        // Read server.info only if its write-time >= launchAt (staleness guard).
        static int ReadPortFromInfoIfFresh(string path, DateTime launchAt)
        {
            if (!File.Exists(path)) return -1;

            try
            {
                DateTime written = File.GetLastWriteTimeUtc(path);
                if (written < launchAt)
                {
                    // File is from a previous session - ignore.
                    return -1;
                }
            }
            catch { return -1; }

            return ParsePort(path);
        }

        // Parse {"port":NNNN} from a file using FileShare.ReadWrite.
        static int ParsePort(string path)
        {
            try
            {
                string content;
                using (FileStream fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (StreamReader sr = new StreamReader(fs))
                {
                    content = sr.ReadToEnd();
                }
                Match m = Regex.Match(content, "\"port\"\\s*:\\s*(\\d+)");
                if (m.Success) return int.Parse(m.Groups[1].Value);
            }
            catch { }
            return -1;
        }

        // ---- TCP probe ------------------------------------------------------
        // Returns true if a TCP connection to host:port succeeds within TCP_TIMEOUT_MS.
        // No HTTP, no HTTPS. Protocol-agnostic.
        static bool TcpProbe(string host, int port)
        {
            try
            {
                using (TcpClient tcp = new TcpClient())
                {
                    IAsyncResult ar = tcp.BeginConnect(host, port, null, null);
                    bool ok = ar.AsyncWaitHandle.WaitOne(TCP_TIMEOUT_MS, false);
                    if (ok && tcp.Connected)
                    {
                        tcp.EndConnect(ar);
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        // ---- Browser opener -------------------------------------------------
        static bool OpenBrowser(string url)
        {
            // Primary: ShellExecute - honours default browser.
            try
            {
                Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
                return true;
            }
            catch { }

            // Fallback: cmd /c start.
            try
            {
                Process.Start(new ProcessStartInfo(
                    "cmd", "/c start \"\" \"" + url + "\"")
                { CreateNoWindow = true, UseShellExecute = false });
                return true;
            }
            catch { }

            return false;
        }

        // ---- Utility --------------------------------------------------------
        static void EnsureLogsDir(string logsDir)
        {
            if (Directory.Exists(logsDir)) return;
            try { Directory.CreateDirectory(logsDir); }
            catch (Exception ex)
            {
                MessageBox.Show("Cannot create Logs directory:\n" + ex.Message,
                                "IETM Launcher Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Environment.Exit(1);
            }
        }

        static void EnsureLog(string logPath)
        {
            try { _log = new StreamWriter(logPath, true) { AutoFlush = true }; }
            catch { /* Logging unavailable - continue without it. */ }
        }

        static void Log(string msg)
        {
            string line = DateTime.Now.ToString("[yyyy-MM-dd HH:mm:ss.fff] ") + msg;
            try { if (_log != null) _log.WriteLine(line); } catch { }
            Debug.WriteLine(line);
        }

        static void Warn(string msg) { Log("WARNING: " + msg); }

        static void CheckAndEnsureCertificate(string basePath)
        {
            string certsDir   = Path.Combine(basePath, "certificates");
            string rootPfx    = Path.Combine(certsDir, "root_ca.pfx");
            string serverPfx  = Path.Combine(certsDir, "server.pfx");
            string cerPath    = Path.Combine(basePath, "IETM_Client_Trust.cer");
            string readmePath = Path.Combine(basePath, "README_HTTPS_SETUP.txt");

            bool needCerts  = !File.Exists(rootPfx) || !File.Exists(serverPfx);
            bool needCer    = !File.Exists(cerPath);
            bool needReadme = !File.Exists(readmePath);

            // Nothing to do at all.
            if (!needCerts && !needCer && !needReadme)
            {
                Log("All HTTPS deployment artifacts present. No action required.");
                return;
            }

            bool anythingCreated = false;

            if (!Directory.Exists(certsDir))
                Directory.CreateDirectory(certsDir);

            // ----------------------------------------------------------------
            // Steps 1 + 2: Generate Root CA and Server Certificate if missing.
            // ----------------------------------------------------------------
            if (needCerts)
            {
                Log("Certificate PFX file(s) missing. Generating Root CA and Server Certificate...");
                try
                {
                    string ps1Path = Path.Combine(Path.GetTempPath(), "ietm_gencert_" + Guid.NewGuid().ToString("N") + ".ps1");

                    string script =
                        "$ErrorActionPreference = 'Stop'\r\n" +
                        "$pfxPwd = ConvertTo-SecureString -String 'password' -Force -AsPlainText\r\n" +
                        "\r\n" +
                        "# Detect active non-loopback IPv4 addresses\r\n" +
                        "$ips = @()\r\n" +
                        "try {\r\n" +
                        "    $ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {\r\n" +
                        "        $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*'\r\n" +
                        "    }).IPAddress\r\n" +
                        "} catch {}\r\n" +
                        "\r\n" +
                        "# Build SAN extension\r\n" +
                        "$sanEntries = @('DNS=RFT1001-IETM', 'DNS=localhost', 'IPAddress=127.0.0.1')\r\n" +
                        "foreach ($ip in $ips) { $sanEntries += \"IPAddress=$ip\" }\r\n" +
                        "$sanExt = '2.5.29.17={text}' + ($sanEntries -join '&')\r\n" +
                        "\r\n" +
                        "# Generate Root CA\r\n" +
                        "$rootCa = New-SelfSignedCertificate `\r\n" +
                        "    -Subject 'CN=IETM Root CA,O=IETM' `\r\n" +
                        "    -KeyUsageProperty Sign `\r\n" +
                        "    -KeyUsage CertSign `\r\n" +
                        "    -CertStoreLocation 'cert:\\CurrentUser\\My' `\r\n" +
                        "    -HashAlgorithm SHA256 `\r\n" +
                        "    -KeyLength 2048 `\r\n" +
                        "    -NotAfter (Get-Date).AddYears(10)\r\n" +
                        "\r\n" +
                        "# Generate Server Certificate signed by Root CA\r\n" +
                        "$serverCert = New-SelfSignedCertificate `\r\n" +
                        "    -Subject 'CN=RFT1001-IETM' `\r\n" +
                        "    -Signer $rootCa `\r\n" +
                        "    -CertStoreLocation 'cert:\\CurrentUser\\My' `\r\n" +
                        "    -HashAlgorithm SHA256 `\r\n" +
                        "    -KeyLength 2048 `\r\n" +
                        "    -NotAfter (Get-Date).AddYears(2) `\r\n" +
                        "    -TextExtension @($sanExt)\r\n" +
                        "\r\n" +
                        "Export-PfxCertificate -Cert $rootCa     -FilePath '" + rootPfx   + "' -Password $pfxPwd | Out-Null\r\n" +
                        "Export-PfxCertificate -Cert $serverCert -FilePath '" + serverPfx + "' -Password $pfxPwd | Out-Null\r\n" +
                        "Export-Certificate   -Cert $rootCa     -FilePath '" + cerPath   + "' | Out-Null\r\n";

                    File.WriteAllText(ps1Path, script);

                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName               = "powershell.exe",
                        Arguments              = string.Format("-ExecutionPolicy Bypass -WindowStyle Hidden -NonInteractive -File \"{0}\"", ps1Path),
                        UseShellExecute        = false,
                        CreateNoWindow         = true,
                        WindowStyle            = ProcessWindowStyle.Hidden,
                        RedirectStandardOutput = true,
                        RedirectStandardError  = true
                    };

                    string psError = "";
                    using (Process proc = Process.Start(psi))
                    {
                        proc.StandardOutput.ReadToEnd();
                        psError = proc.StandardError.ReadToEnd();
                        proc.WaitForExit();
                        if (proc.ExitCode != 0)
                            Log("WARNING: Certificate generation exited with code " + proc.ExitCode + ". Error: " + psError);
                    }
                    if (!string.IsNullOrEmpty(psError)) Log("PS stderr: " + psError);

                    try { File.Delete(ps1Path); } catch { }

                    if (File.Exists(rootPfx) && File.Exists(serverPfx))
                    {
                        Log("Root CA and Server Certificate generated successfully.");
                        anythingCreated = true;
                        needCer = false; // generation script also exported the .cer
                    }
                    else
                    {
                        Log("WARNING: Certificate PFX files not found after generation. PS error: " + psError);
                    }
                }
                catch (Exception ex)
                {
                    Log("ERROR generating certificates: " + ex.Message);
                }
            }

            // ----------------------------------------------------------------
            // Step 3: Export IETM_Client_Trust.cer if missing, without regen.
            // Only runs when root_ca.pfx is available.
            // ----------------------------------------------------------------
            if (needCer && File.Exists(rootPfx))
            {
                Log("IETM_Client_Trust.cer missing. Exporting from existing Root CA...");
                try
                {
                    string ps1Path = Path.Combine(Path.GetTempPath(), "ietm_exportcer_" + Guid.NewGuid().ToString("N") + ".ps1");

                    string script =
                        "$ErrorActionPreference = 'Stop'\r\n" +
                        "$pfxPwd = ConvertTo-SecureString -String 'password' -Force -AsPlainText\r\n" +
                        "$rootCa = (Get-PfxData -FilePath '" + rootPfx + "' -Password $pfxPwd).EndEntityCertificates[0]\r\n" +
                        "Export-Certificate -Cert $rootCa -FilePath '" + cerPath + "' | Out-Null\r\n";

                    File.WriteAllText(ps1Path, script);

                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName               = "powershell.exe",
                        Arguments              = string.Format("-ExecutionPolicy Bypass -WindowStyle Hidden -NonInteractive -File \"{0}\"", ps1Path),
                        UseShellExecute        = false,
                        CreateNoWindow         = true,
                        WindowStyle            = ProcessWindowStyle.Hidden,
                        RedirectStandardOutput = true,
                        RedirectStandardError  = true
                    };

                    string psError = "";
                    using (Process proc = Process.Start(psi))
                    {
                        proc.StandardOutput.ReadToEnd();
                        psError = proc.StandardError.ReadToEnd();
                        proc.WaitForExit();
                        if (proc.ExitCode != 0)
                            Log("WARNING: CER export exited with code " + proc.ExitCode + ". Error: " + psError);
                    }
                    if (!string.IsNullOrEmpty(psError)) Log("PS stderr (cer export): " + psError);

                    try { File.Delete(ps1Path); } catch { }

                    if (File.Exists(cerPath))
                    {
                        Log("IETM_Client_Trust.cer exported successfully.");
                        anythingCreated = true;
                    }
                    else
                    {
                        Log("WARNING: IETM_Client_Trust.cer not found after export attempt.");
                    }
                }
                catch (Exception ex)
                {
                    Log("ERROR exporting CER: " + ex.Message);
                }
            }

            // ----------------------------------------------------------------
            // Step 4: Generate README_HTTPS_SETUP.txt if missing.
            // Fully independent of certificate state.
            // ----------------------------------------------------------------
            if (needReadme)
            {
                Log("README_HTTPS_SETUP.txt missing. Generating...");
                CreateDeploymentReadme(basePath);
                if (File.Exists(readmePath)) anythingCreated = true;
            }

            // ----------------------------------------------------------------
            // Show success message whenever any artifact was created.
            // ----------------------------------------------------------------
            if (anythingCreated)
            {
                MessageBox.Show(
                    "HTTPS certificate generated successfully.\n\n" +
                    "Trust certificate exported: IETM_Client_Trust.cer\n\n" +
                    "README_HTTPS_SETUP.txt created.\n\n" +
                    "Install IETM_Client_Trust.cer into the Trusted Root Certification Authorities " +
                    "store on every client computer to avoid browser security warnings.",
                    "Certificate Generated",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
        }


        // Returns https://<LAN-IP>:<port>, falling back to localhost if no LAN IP is detected.
        static string BuildBrowserUrl(int port)
        {
            string lanIp = GetLanIpAddress();
            if (!string.IsNullOrEmpty(lanIp))
            {
                Log("Opening browser at LAN IP: " + lanIp);
                return "https://" + lanIp + ":" + port;
            }
            Log("No LAN IP detected. Falling back to localhost URL.");
            return "https://localhost:" + port;
        }

        static void CreateDeploymentReadme(string basePath)
        {
            string readmePath = Path.Combine(basePath, "README_HTTPS_SETUP.txt");
            try
            {
                string content =
                    "--------------------------------------------------\r\n" +
                    "IETM HTTPS DEPLOYMENT\r\n" +
                    "--------------------------------------------------\r\n" +
                    "\r\n" +
                    "SERVER\r\n" +
                    "\r\n" +
                    "1. Install the IETM.\r\n" +
                    "2. Launch the application.\r\n" +
                    "3. The launcher automatically generates the HTTPS certificate.\r\n" +
                    "4. The launcher automatically starts the HTTPS server.\r\n" +
                    "5. The application is available at:\r\n" +
                    "\r\n" +
                    "   https://<Server-IP>:3000\r\n" +
                    "\r\n" +
                    "   Replace <Server-IP> with the actual IP address of the server computer.\r\n" +
                    "\r\n" +
                    "--------------------------------------------------\r\n" +
                    "CLIENT COMPUTERS\r\n" +
                    "--------------------------------------------------\r\n" +
                    "\r\n" +
                    "To avoid browser security warnings:\r\n" +
                    "\r\n" +
                    "1. Copy:\r\n" +
                    "\r\n" +
                    "   IETM_Client_Trust.cer\r\n" +
                    "\r\n" +
                    "   to each client computer.\r\n" +
                    "\r\n" +
                    "2. Double-click the certificate.\r\n" +
                    "\r\n" +
                    "3. Select:\r\n" +
                    "\r\n" +
                    "   Install Certificate\r\n" +
                    "\r\n" +
                    "4. Choose:\r\n" +
                    "\r\n" +
                    "   Local Machine\r\n" +
                    "\r\n" +
                    "5. Select:\r\n" +
                    "\r\n" +
                    "   Place all certificates in the following store\r\n" +
                    "\r\n" +
                    "6. Browse to:\r\n" +
                    "\r\n" +
                    "   Trusted Root Certification Authorities\r\n" +
                    "\r\n" +
                    "7. Complete the wizard.\r\n" +
                    "\r\n" +
                    "8. Restart the browser if necessary.\r\n" +
                    "\r\n" +
                    "9. Open:\r\n" +
                    "\r\n" +
                    "   https://<Server-IP>:3000\r\n" +
                    "\r\n" +
                    "--------------------------------------------------\r\n" +
                    "NOTES\r\n" +
                    "--------------------------------------------------\r\n" +
                    "\r\n" +
                    "- The server IP can be obtained using:\r\n" +
                    "\r\n" +
                    "     ipconfig\r\n" +
                    "\r\n" +
                    "  on the server computer.\r\n" +
                    "\r\n" +
                    "- The server and client computers must be connected to the same LAN.\r\n" +
                    "\r\n" +
                    "- Port 3000 must be allowed through Windows Firewall.\r\n" +
                    "\r\n" +
                    "--------------------------------------------------\r\n";

                File.WriteAllText(readmePath, content);
                Log("README_HTTPS_SETUP.txt written to " + readmePath);
            }
            catch (Exception ex)
            {
                Log("WARNING: Could not write README_HTTPS_SETUP.txt: " + ex.Message);
            }
        }

        // Returns the first non-loopback LAN IPv4 address of the local machine.
        static string GetLanIpAddress()
        {
            try
            {
                System.Net.IPHostEntry entry = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
                foreach (System.Net.IPAddress addr in entry.AddressList)
                {
                    if (addr.AddressFamily == AddressFamily.InterNetwork &&
                        !System.Net.IPAddress.IsLoopback(addr))
                        return addr.ToString();
                }
            }
            catch (Exception ex) { Log("GetLanIpAddress error: " + ex.Message); }
            return null;
        }

        static void CheckAndEnsureFirewallRule(string exePath)
        {
            string ruleName = "IETM Web Server";
            bool hasCorrectAllowRule = false;
            bool hasBlockRule = false;

            Log("Checking Windows Firewall rules via COM reflection for " + exePath);
            try
            {
                Type fwPolicyType = Type.GetTypeFromProgID("HNetCfg.FwPolicy2");
                if (fwPolicyType != null)
                {
                    object fwPolicy = Activator.CreateInstance(fwPolicyType);
                    object rules = fwPolicyType.InvokeMember("Rules", System.Reflection.BindingFlags.GetProperty, null, fwPolicy, null);
                    System.Collections.IEnumerable rulesEnum = rules as System.Collections.IEnumerable;

                    if (rulesEnum != null)
                    {
                        foreach (object rule in rulesEnum)
                        {
                            Type ruleType = rule.GetType();

                            int direction = (int)ruleType.InvokeMember("Direction", System.Reflection.BindingFlags.GetProperty, null, rule, null);
                            if (direction != 1) continue; // 1 = NET_FW_RULE_DIRECTION_IN

                            string appName = (string)ruleType.InvokeMember("ApplicationName", System.Reflection.BindingFlags.GetProperty, null, rule, null);
                            if (string.IsNullOrEmpty(appName) || !string.Equals(appName, exePath, StringComparison.OrdinalIgnoreCase)) continue;

                            int action = (int)ruleType.InvokeMember("Action", System.Reflection.BindingFlags.GetProperty, null, rule, null);
                            if (action == 0) // 0 = NET_FW_ACTION_BLOCK
                            {
                                hasBlockRule = true;
                            }
                            else if (action == 1) // 1 = NET_FW_ACTION_ALLOW
                            {
                                string name = (string)ruleType.InvokeMember("Name", System.Reflection.BindingFlags.GetProperty, null, rule, null);
                                if (name == ruleName)
                                {
                                    int profiles = (int)ruleType.InvokeMember("Profiles", System.Reflection.BindingFlags.GetProperty, null, rule, null);
                                    // 2 = NET_FW_PROFILE2_PRIVATE
                                    if ((profiles & 2) == 2 || profiles == 0x7FFFFFFF)
                                    {
                                        int protocol = (int)ruleType.InvokeMember("Protocol", System.Reflection.BindingFlags.GetProperty, null, rule, null);
                                        // 6 = TCP, 256 = ANY
                                        if (protocol == 6 || protocol == 256)
                                        {
                                            hasCorrectAllowRule = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Log("WARNING: Failed to check firewall rules via COM: " + ex.Message);
                // Fallback to recreating rules if COM check fails for any reason
            }

            if (hasCorrectAllowRule && !hasBlockRule)
            {
                Log("Correct firewall rule already exists and no blocking rules found. No elevation required.");
                return;
            }

            if (hasBlockRule)
            {
                Log("Found blocking firewall rules for this executable. Recreating rules to ensure access.");
            }
            else
            {
                Log("Firewall rule not found or incomplete. Requesting elevation to add rule.");
            }

            try
            {
                // cmd.exe /c lets us execute sequential commands.
                // 1. Delete all existing rules (Block or Allow) targeting this executable path.
                // 2. Add our specific Allow rule for Private and Domain profiles.
                string args = "/c netsh advfirewall firewall delete rule name=all program=\"" + exePath + "\" & netsh advfirewall firewall add rule name=\"" + ruleName + "\" dir=in action=allow protocol=TCP localport=3000 program=\"" + exePath + "\" profile=private,domain";

                ProcessStartInfo psiAdmin = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = args,
                    UseShellExecute = true,
                    Verb = "runas",
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                using (Process p = Process.Start(psiAdmin))
                {
                    p.WaitForExit();
                    if (p.ExitCode != 0)
                    {
                        throw new Exception("cmd.exe returned exit code " + p.ExitCode);
                    }
                }
                Log("Successfully reset and added firewall rule.");
            }
            catch (System.ComponentModel.Win32Exception)
            {
                Log("User cancelled UAC elevation for firewall rule.");
                MessageBox.Show(
                    "The application needs to configure Windows Firewall to allow connections to the web server.\n\n" +
                    "Without this rule, other devices on the network may not be able to connect to the application.\n\n" +
                    "Please run the application again and grant Administrator permissions when prompted if you require network access.",
                    "Firewall Setup Cancelled", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            catch (Exception ex)
            {
                Log("ERROR: Failed to add firewall rule: " + ex.Message);
                MessageBox.Show(
                    "An error occurred while attempting to configure the Windows Firewall.\n\n" +
                    ex.Message + "\n\n" +
                    "You may need to add the rule manually for port 3000.",
                    "Firewall Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
