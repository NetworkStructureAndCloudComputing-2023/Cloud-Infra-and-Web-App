# Infrastrcuture as Code wiith Pulumi

## Project Details

### For AWS

- Install and set up the AWS command-line interface. Here is the link for that : https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html
- Install pulumi : brew install pulumi/tap/pulumi
- Create Project : mkdir quickstart && cd quickstart && pulumi new aws-typescript
- Start the pulumi with config : pulumi config set aws:profile profile-name
- To bring up the infra - pulumi up
  

### For Google CLoud

- Authenticate google cloud : gcloud auth application-default login
- For pulumi confgi: pulumi config set gcp:project your-gcp-project-id 