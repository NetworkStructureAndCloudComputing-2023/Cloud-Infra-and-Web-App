# Assignment

- The web application will load account information from a CSV file from well known location /opt/user.csv.
- The application should load the file at startup and create users based on the information provided in the CSV file.
- The application should create new user account if one does not exist.
- If the account already exists, no action is required i.e. no updates.
- Deletion is not supported.
- Example CSV file can be downloaded from here.
- The user's password must be hashed using BCrypt before it is stored in the database.
- Users should not be able to set values for account_created and account_updated. Any value provided for these fields must be ignored
- Users can make POST requests for submission.
- Users can submit multiple times for each assignment based on retries config provided.
- Once user exceeds retries (number of attempts), you must reject the request.
- Submission should be rejected if the due date (deadline) for assignment has passed.
- Post the URL to the SNS topic along with user info such as their email address.

------------------------------
# Author name
Gloria Singh

------------------------------
# Email
singh.gl@northeastern 

------------------------------
# Project Requirements

## Packer & AMIs - Building Custom Application AMI using Packer

- Use Debian 12 as your source image to create a custom AMI using Packer.
- All AMIs you build should be private. Only you can deploy EC2 instances from it.
- All AMI builds should happen in your DEV AWS account and shared with your DEMO account.
- AMI builds should be set up to run in your default VPC.
- The AMI should include everything needed to run your application and the application binary itself. For e.g., if you are using Tomcat to run your Java web application, your AMI must have Java & Tomcat installed. You should also make sure the Tomcat service will start up when an instance is launched. If you are using Python, make sure you have the right version of python and the libraries you need to be installed in the AMI.

## Packer Continuous Integration - Add New GitHub Actions Workflow for Status Check

- Run the packer fmt command. If this command modifies the packer template, the workflow should fail and prevent users from merging the pull request.
- Run the packer validate command. If this command fails to validate the packer template, the workflow should fail and prevent users from merging the pull request.

## When Pull request is done

- Run the integration test.
- Build the application artifact (war, jar, zip, etc.). This artifact should be build on the GitHub actions runner and not in the AMI i.e. do not git clone your repository in the packer template and then build it. You will build the artifact on the runner and copy it into the AMI.
- Build the AMI with application dependencies and set up the application by copying the application artifacts and the configuration files.
- The AMI built must be shared with the DEMO account.
- No AMI should be built if the any of the jobs or steps in the workflow fail.

## Application Security Group¶
- Create an EC2 security group for your EC2 instances that will host web applications.
- Add ingress rule to allow TCP traffic on ports 22, 80, 443, and port on which your application runs from anywhere in the world.
This security group will be referred to as the application security group.

## EC2 Instance¶
- Create an EC2 instance with the following specifications. For any parameter not provided in the table below, you may go with default values. The EC2 instance must be launched in the VPC created by your Pulumi IaC code. You cannot launch the EC2 instance in the default VPC.

- Application security group should be attached to this EC2 instance.
Make sure the EBS volumes are terminated when EC2 instances are terminated.

## Setup Autorun Using Systemd¶

- To ensure that your service starts up after cloud-init has completed execution, you can have your service be required/wanted by cloud-init instead of the usual multi-user. See https://serverfault.com/a/937723
- Avoid starting the application until cloud-init has completed execution at which point, your userdata script would have executed.

## The Auto Scaling Application Stack¶
So far our web application has been accessible by the IP address of the EC2 instance on HTTP protocol. We will now disable direct access to our web application using the IP address of the EC2 instance. The web application will now only be accessible from the load balancer.

## Implement Lambda Function¶ - Serverless and Email
- The Lambda function will be invoked by the SNS notification.
- The Lambda function is responsible for following:
  - Download the release from the GitHub repository and store it in Google Cloud Storage Bucket.
  - Email the user the status of download.
  - Track the emails sent in DynamoDB.

## Setup Application Load Balancer For Your Web Application¶
- EC2 instances launched in the auto-scaling group will now be load balanced.
- Set up an Application load balancer to accept HTTP traffic on port 80 and forward it to your application instances on whatever port it listens on. You are not required to support HTTP to HTTPS redirection.
- Attach the load balancer security group to the load balancer.

## Google Cloud Setup¶
- From the Google Cloud Console, create dev and demo projects.
- Enable required services in the project from the console.
- Install gcloud cli on your laptop and login with gcloud auth login and gcloud auth application-default login

## Command to import SSL certificate

 sudo aws acm import-certificate \
    --certificate fileb://demo_gloriasingh_me.crt \
    --private-key fileb://private.key \
    --certificate-chain fileb://demo_gloriasingh_me.ca-bundle \
    --region us-east-1 \
    --profile gloria-iam-user-dev

