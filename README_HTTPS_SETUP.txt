--------------------------------------------------
IETM HTTPS DEPLOYMENT
--------------------------------------------------

SERVER

1. Install the IETM.
2. Launch the application.
3. The launcher automatically generates the HTTPS certificate.
4. The launcher automatically starts the HTTPS server.
5. The application is available at:

   https://<Server-IP>:3000

   Replace <Server-IP> with the actual IP address of the server computer.

--------------------------------------------------
CLIENT COMPUTERS
--------------------------------------------------

To avoid browser security warnings:

1. Copy:

   IETM_Client_Trust.cer

   to each client computer.

2. Double-click the certificate.

3. Select:

   Install Certificate

4. Choose:

   Local Machine

5. Select:

   Place all certificates in the following store

6. Browse to:

   Trusted Root Certification Authorities

7. Complete the wizard.

8. Restart the browser if necessary.

9. Open:

   https://<Server-IP>:3000

--------------------------------------------------
NOTES
--------------------------------------------------

- The server IP can be obtained using:

     ipconfig

  on the server computer.

- The server and client computers must be connected to the same LAN.

- Port 3000 must be allowed through Windows Firewall.

--------------------------------------------------
