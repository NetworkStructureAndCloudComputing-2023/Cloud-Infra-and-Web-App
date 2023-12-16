#!/bin/bash

# Update the package references
sudo apt-get update

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# sudo apt-get install -y mariadb-server

# # Start MariaDB
# sudo  mysql -u root -p'root' -e "FLUSH PRIVILEGES;"
# sudo  mysql -u root -p'root' -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'root';"
# sudo  mysql -u root -p'root' -e "CREATE USER 'admin'@'localhost' IDENTIFIED BY 'root';"
# sudo  mysql -u root -p'root' -e "GRANT ALL ON *.* TO 'admin'@'localhost';"
# sudo  mysql -u root -p'root' -e "FLUSH PRIVILEGES;"

# # Create the 'health' database
# sudo  mysql -u root -p'root' -e "CREATE DATABASE health;"

#sudo apt-get install -y mariadb-server

wget https://amazoncloudwatch-agent.s3.amazonaws.com/debian/amd64/latest/amazon-cloudwatch-agent.deb

sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
echo "cloudwatch download complete"

sudo systemctl enable amazon-cloudwatch-agent
echo "cloudwatch enabled now"

# Install unzip
sudo apt-get install -y unzip


echo "Environment setup complete."
