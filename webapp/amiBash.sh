#!/bin/bash

echo "ami Bash script is working"

SERVICE_CONTENT="[Unit]
Description=My Node.js App Service
After=cloud-final.service

[Service]
EnvironmentFile=/etc/environment 
WorkingDirectory=/home/admin/webapp
Restart=always
User=gloria
Group=gloria
ExecStart=/usr/bin/node /home/admin/webapp/app.js
StandardOutput=append:/var/log/csye6225.log

[Install]
WantedBy=cloud-init.target
"

sudo touch /etc/systemd/system/myapp.service
sudo chmod 764 /etc/systemd/system/myapp.service

# Create the service file and write the content to it
echo "$SERVICE_CONTENT" | sudo tee /etc/systemd/system/myapp.service > /dev/null


# Reload systemd to recognize the new service
sudo systemctl daemon-reload

sudo systemctl enable myapp.service



