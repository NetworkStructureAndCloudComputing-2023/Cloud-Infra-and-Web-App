# my_app_ami.pkr.hcl

packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1" // if default value is not present then

}

variable "source_ami" {
  type    = string
  default = "ami-06db4d78cb1d3bbf9"
}

variable "ssh_username" {
  type    = string
  default = "admin"
}

variable "subnet_id" {
  type    = string
  default = "subnet-01c51867dce2ec5e4"

}

//shared with dev and demo account
variable "ami_user" {
  type    = list(string)
  default = ["437213623140", "639115432758"]
}

//amazon-ebs is the source
source "amazon-ebs" "debian" {
  region          = "${var.aws_region}"
  ami_name        = "csye6225-webapp-V2-version"
  ami_description = "AMI for CSYE 6225"
  instance_type   = "t2.micro"
  source_ami      = "${var.source_ami}"
  ssh_username    = "${var.ssh_username}"
  subnet_id       = "${var.subnet_id}"
  ami_users       = "${var.ami_user}"

  launch_block_device_mappings {
    delete_on_termination = true
    device_name           = "/dev/xvda"
    volume_size           = 25
    volume_type           = "gp2"
  }
}

//build sections
build {
  name = "my-learn-packer"
  sources = [
    "source.amazon-ebs.debian", //trailing commma, makes it easier to add or remove elements from the list 
  ]

  provisioner "file" {
    source      = "webapp.zip"
    destination = "/home/admin/"
  }

  provisioner "file" {
    source      = "users.csv"
    destination = "/home/admin/"
  }

  provisioner "shell" {
    inline = [
      "sudo mv /home/admin/users.csv /opt",
      "sudo chmod +x /opt/users.csv"
    ]
  }

  provisioner "shell" {
    script = "myScript.sh"
  }

  provisioner "shell" {
    inline = [
      "sudo unzip  /home/admin/webapp.zip -d /home/admin/webapp",
      "sudo groupadd gloria",
      "sudo useradd -s /bin/false -g gloria -m gloria",
      "sudo chown -R gloria:gloria /home/admin/webapp",
      "sudo chmod g+x /home/admin/webapp",
      "cd webapp",
      "sudo chmod +x /home/admin/webapp",
      "sudo npm install"
    ]
  }
  provisioner "shell" {
    script = "amiBash.sh"
  }
}

