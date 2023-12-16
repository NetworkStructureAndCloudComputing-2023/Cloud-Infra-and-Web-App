import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import fs from 'fs';
import yaml from 'js-yaml';
import * as request from 'request';
import { Base64 } from 'js-base64';
import * as gcp from "@pulumi/gcp";

const gcp_bucket = new gcp.storage.Bucket("gcp_bucket", {
    location: "US",
    uniformBucketLevelAccess: true,
    forceDestroy: true,
});

const service_account = new gcp.serviceaccount.Account("service-account", {
    accountId: "service-account-id",
    displayName: "My Service Account",
});

const mykey = new gcp.serviceaccount.Key("mykey", {
    serviceAccountId: service_account.name,
    publicKeyType: "TYPE_X509_PEM_FILE",
});

const objectCreator = new gcp.storage.BucketIAMMember("objectCreator", {
    bucket: gcp_bucket.name,
    role: "roles/storage.objectCreator",
    member: service_account.email.apply(email => `serviceAccount:${email}`),
});

const objectViewer = new gcp.storage.BucketIAMMember("bucketObjectViewer", {
    bucket: gcp_bucket.name,
    role: "roles/storage.objectViewer",
    member: service_account.email.apply(email => `serviceAccount:${email}`),
});

const objectUser = new gcp.storage.BucketIAMMember("bucketObjectUser", {
    bucket: gcp_bucket.name,
    role: "roles/storage.objectUser",
    member: service_account.email.apply(email => `serviceAccount:${email}`),
});


const bucketName = gcp_bucket.name
const privateKey = mykey.privateKey

// Dynamically retrieve the AWS account ID
const callerIdentity = aws.getCallerIdentity({});
const accountId = callerIdentity.then(identity => identity.accountId);


const configFile = 'config.yaml';
const config = yaml.load(fs.readFileSync(configFile, 'utf8'));

const {igName, vpc_config, region, publicRouteTableConfig,baseMask, EC2, securityGroup, digitalocean, rdsintance, scaleDown,scaleUp ,sesResource, ssmPolicyAttachmentArn, cloudWatchPolicyAttachmentArn, lambdaLogsPolicyAttachmentArn, CertificateArn } = config;

const baseIp= "10.0";
const privateSubnets=[]
const publicSubnets=[]

const vpc = new aws.ec2.Vpc("main",
    {
        cidrBlock: vpc_config['Cidr'],
        tags: {
            Name: vpc_config['Name'],
        },      
});

const generateCidrBlock =(baseIp,baseMask,index)=>{
    return `${baseIp}.${index}.0${baseMask}`;
}

const gateway = new aws.ec2.InternetGateway("gw", {
    tags: {
        Name: igName,
    },
});

const internetGatewayAttachment = new aws.ec2.InternetGatewayAttachment("exampleInternetGatewayAttachment", {
    internetGatewayId: gateway.id,
    vpcId: vpc.id,
    tags: {
        Name: igName,
    }   
});

const availableAZs = await aws.getAvailabilityZones({ state: "available", region: region });

function calculateCidrBlock(index, subnetType){

    const base = subnetType === "public" ? 0 : 10; // different ranges for public and private
    const max = 255;
    const mask = "/24";
    let calculated = index + base;
    if (calculated >= max) {
        throw new Error('Exceeded the maximum IP range');
    }
    return `10.0.${calculated}.0${mask}`;
}

let subnetCount =0;
availableAZs.names.forEach((az, index) => {
    if(subnetCount<3){
        const publicSubnet = new aws.ec2.Subnet(`publicSubnet${index}`, {
            vpcId: vpc.id,
            availabilityZone: az,
            cidrBlock: calculateCidrBlock(index, "public"),
            mapPublicIpOnLaunch: true,
            tags: {
                Name: `PublicSubnet${index}`,
            },
        }, {dependsOn:[vpc]});

        
        const privateSubnet = new aws.ec2.Subnet(`privateSubnet${index}`, {
            vpcId: vpc.id,
            availabilityZone: az,
            cidrBlock: calculateCidrBlock(index, "private"),
            mapPublicIpOnLaunch: true,
            tags: {
                Name: `PrivateSubnet${index}`,
            },
        }, {dependsOn:[vpc]});

        publicSubnets.push(publicSubnet)
        privateSubnets.push(privateSubnet)
    
        subnetCount++;
} 
    else 
    {
        return;
    }   
});

//creating public route table
const publicRouteTable = new aws.ec2.RouteTable('publicRouteTable', {
    vpcId: vpc.id,
    tags: {
        Name: "publicRouteTable",
    }  
});

publicSubnets.slice(0, subnetCount+1).forEach((publicSubnet, index) => {
    const subnetAssociation = new aws.ec2.RouteTableAssociation(`publicSubnetAssociation${index}`, {
        subnetId: publicSubnet.id,
        routeTableId: publicRouteTable.id,
    });
});


const privateRouteTable = new aws.ec2.RouteTable('privateRouteTable', {
    vpcId: vpc.id,
    tags: {
        Name: "privateRouteTable",
    }  
});
            

privateSubnets.forEach((privateSubnet, index) => {
    const subnetAssociation = new aws.ec2.RouteTableAssociation(`privateSubnetAssociation${index}`, {
        subnetId: privateSubnet.id,
        routeTableId: privateRouteTable.id,
    });
});

const publicRoute = new aws.ec2.Route('publicRoute', {
    routeTableId: publicRouteTable.id,
    destinationCidrBlock: publicRouteTableConfig['Cidr'],
    gatewayId: gateway.id,   
});


//creating load balancer security group
const loadBalancerSg = new aws.ec2.SecurityGroup("loadBalancerSg", {
    description: "Load balancer security group",
    vpcId:vpc.id,
    ingress: [
        // {
        //     protocol: 'tcp',
        //     fromPort: 80,
        //     toPort: 80,
        //     cidrBlocks: ['0.0.0.0/0']
        // },
        //HTTPS access
        {
            protocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ['0.0.0.0/0']
        },
    ],
});



//app security group for EC2 instance
const appSecurityGroup = new aws.ec2.SecurityGroup("app-security-group", {
    vpcId: vpc.id,
    ingress: [
        {
            fromPort: securityGroup['sshPort'],
            toPort: securityGroup['sshPort'],
            protocol: securityGroup['protocol'],
            cidrBlocks: [securityGroup['Cidr']],
        },
        {
            fromPort:securityGroup['localPort'] ,
            toPort: securityGroup['localPort'],
            protocol: securityGroup['protocol'],
            securityGroups: [loadBalancerSg.id],
        },
    ],
    egress: [
        {
            protocol: 'tcp',
            fromPort: 443, 
            toPort: 443,   
            cidrBlocks: ['0.0.0.0/0']
        },
    ],
});
    
//outbound rule for load balancer security group
let myloadbalancerEgressRule = new aws.ec2.SecurityGroupRule("myloadbalancerEgressRule", {
    type: "egress",
    securityGroupId: loadBalancerSg.id,
    protocol: "tcp",
    fromPort: 8080,
    toPort: 8080,
    sourceSecurityGroupId: appSecurityGroup.id
  
});

//creating key value pair for ssh
const keyPair = new aws.ec2.KeyPair("digitalocean", {
    publicKey: digitalocean
});

//creating DB security group which which will be connected to private subnet
const dbSecurityGroup = new aws.ec2.SecurityGroup("dbSecurityGroup",{
    vpcId: vpc.id,
    ingress : [
        {   
            protocol:"tcp",
            fromPort:3306,
            toPort: 3306,
            securityGroups: [appSecurityGroup.id],
        },
    ],
});

//creating outbound rule for dbSecurityGroup
let myEgressRule = new aws.ec2.SecurityGroupRule("myDbEgressRule", {
    type: "egress",
    securityGroupId:  appSecurityGroup.id,
    protocol: "tcp",
    fromPort: 3306,
    toPort: 3306,
    sourceSecurityGroupId: dbSecurityGroup.id,
  
  })

//creating parameter group
const dbParamterGroup= new aws.rds.ParameterGroup("db-parameter-group",{
    family: "mariadb10.11",   
})

//creating a dbSubnetGroup
const dbSubnetGroup = new aws.rds.SubnetGroup("my-db-subnetgroup",{
    subnetIds:privateSubnets.map(subnet=>subnet.id),
});


//creating rds instance
const rdsInstance= new aws.rds.Instance("my-mariadb-instance",{

    allocatedStorage:20,
    engine: "mariadb",
    engineVersion: "10.11.4",
    instanceClass:"db.t3.micro",
    multiAz: false,
    parameterGroupName:dbParamterGroup.name,
    dbName: rdsintance['dbName'],
    username: rdsintance['username'],
    password: rdsintance['password'],
    dbSubnetGroupName: dbSubnetGroup.name,
    publiclyAccessible:false,
    vpcSecurityGroupIds: [dbSecurityGroup.id],
    skipFinalSnapshot: true,

});


const snsTopic = new aws.sns.Topic("snsTopic");

// Define the SNS publish policy document
const snsPublishPolicyDocument = pulumi.output(aws.iam.getPolicyDocument({
    statements: [{
        actions: ["sns:Publish"],
        resources: [snsTopic.arn], // ARN of the SNS Topic
        effect: "Allow",
    }],
}));

// Create an IAM Policy with the above document
const snsPublishPolicy = new aws.iam.Policy("snsPublishPolicy", {
    policy: snsPublishPolicyDocument.apply(document => document.json),
});


const snsTopicArn = snsTopic.arn

const userDataScript = snsTopic.arn.apply(arn => pulumi.interpolate`#!/bin/bash
echo "HOST=${rdsInstance.endpoint.apply(endpoint => endpoint.split(":")[0])}" >> /etc/environment
echo "USER=admin" >> /etc/environment
echo "DATABASE=health" >> /etc/environment
echo "PASSWORD=root1234" >> /etc/environment
echo "DATABASE_PORT=3306" >> /etc/environment
echo "DIALECT=mariadb" >> /etc/environment
echo "DEFAULTUSERPATH=/opt/users.csv" >> /etc/environment
echo "snsTopicArn=${arn}" >> /etc/environment
    # Configure the CloudWatch Agent
    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \\
        -a fetch-config \\
        -m ec2 \\
        -c file:/home/admin/webapp/cloudwatch-config.json \\
        -s
    source /etc/environment
`);


// IAM Role for EC2
const ec2Role = new aws.iam.Role("my-instance-role", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com",
    }),
});

const ssmPolicyAttachment = new aws.iam.RolePolicyAttachment("ssmPolicyAttachment", {
    role: ec2Role.name,
    policyArn: ssmPolicyAttachmentArn,
});

// Attach the CloudWatchAgentServerPolicy policy to the role for CloudWatch
const cloudWatchPolicyAttachment = new aws.iam.RolePolicyAttachment("cloudWatchPolicyAttachment", {
    role: ec2Role.name,
    policyArn: cloudWatchPolicyAttachmentArn,
});

//instance profile for ec2
const instanceProfile = new aws.iam.InstanceProfile("ec2instanceProfile", {
    role: ec2Role,
});

// Attach the SNS Policy to the IAM Role
const snsPublishPolicyAttachment = new aws.iam.RolePolicyAttachment("snsPublishPolicyAttachment", {
    role: ec2Role.name, // Assuming ec2Role is the IAM role object
    policyArn: snsPublishPolicy.arn,
});

const DNSZone = aws.route53.getZone({ name: "demo.gloriasingh.me." }, { async: true });

const userDataEncoded = userDataScript.apply(ud => Buffer.from(ud).toString('base64'))

//Launch template for auto scaling
const launchTemplate = new aws.ec2.LaunchTemplate("launch-template", {
    name:"MyLaunchTemplate",
    imageId: EC2['amiId'],
    instanceType: 't2.micro',
    // keyName: keyPair.keyName,
    networkInterfaces: [{
        associatePublicIpAddress: true,
        securityGroups: [appSecurityGroup.id],
    }],
    iamInstanceProfile: {
        name: instanceProfile.name,
    },
    userData: userDataEncoded,
    tags: {
        Name: "MyLaunchTemplate",
    },
});


//auto scaling group for load balancer
const autoScalingGroup = new aws.autoscaling.Group("auto-scaling-group", {
    name:"auto-scaling-group",
    launchTemplate: {
        id: launchTemplate.id,
        version: `$Latest`,
    },
    minSize: 1,
    maxSize: 3,
    desiredCapacity: 1,
    vpcZoneIdentifiers: publicSubnets.map(subnet => subnet.id),
    tags: [
        {
            key: "Name",
            value: "MyAutoscalingGroupInstance",
            propagateAtLaunch: true,
        },
    ],
});

// Scale Up Policy
const scaleUpPolicy = new aws.autoscaling.Policy("scale-up", {
    autoscalingGroupName: autoScalingGroup.name,
    adjustmentType: "ChangeInCapacity",
    scalingAdjustment: 1,
    policyType: "SimpleScaling",
    cooldown: scaleUp['cooldown']
});

//creating alarm for scale up policy
const scaleUpAlarm = new aws.cloudwatch.MetricAlarm("scale-up-alarm", {
    metricName: "CPUUtilization",
    namespace: "AWS/EC2",
    statistic: "Average",
    period:  scaleUp['period'],
    evaluationPeriods:  scaleUp['evaluationPeriods'],
    threshold:  scaleUp['threshold'],
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    dimensions: {
        AutoScalingGroupName: autoScalingGroup.name,
    },
    alarmActions: [scaleUpPolicy.arn],//scale up
});

// Scale Down Policy
const scaleDownPolicy = new aws.autoscaling.Policy("scale-down", {
    autoscalingGroupName: autoScalingGroup.name,
    adjustmentType: "ChangeInCapacity",
    scalingAdjustment: -1,
    policyType: "SimpleScaling",
    cooldown: scaleDown['cooldown'],
});

//creating alarm for scale down policy
const scaleDownAlarm = new aws.cloudwatch.MetricAlarm("scale-down-alarm", {
    metricName: "CPUUtilization",
    namespace: "AWS/EC2",
    statistic: "Average",
    period: scaleDown['period'],
    evaluationPeriods: scaleDown['evaluationPeriods'],
    threshold: scaleDown['threshold'],
    comparisonOperator: "LessThanOrEqualToThreshold",
    dimensions: {
        AutoScalingGroupName: autoScalingGroup.name,
    },
    alarmActions: [scaleDownPolicy.arn],//scale down
});

//target group with application port
const targetGroup = new aws.lb.TargetGroup("my-target-group", {
    port: 8080, 
    protocol: "HTTP",
    vpcId: vpc.id,
    targetType: "instance",
    healthCheck: {
        interval: 60, 
        path: "/healthz",
    },
});

//creating load balancer 
const loadBalancer = new aws.lb.LoadBalancer("my-load-balancer", {
    internal: false,
    loadBalancerType: "application",
    securityGroups: [loadBalancerSg.id], // load balancer security group
    subnets: publicSubnets.map(subnet => subnet.id), // public subnets
    tags: {
        Name: "MyApplicationLoadBalancer",
    },
});

//creating listener for HTTP
const httpListener = new aws.lb.Listener("http-listener", {
    loadBalancerArn: loadBalancer.arn,
    port: 443,
    protocol: "HTTPS",
    certificateArn: CertificateArn,
    defaultActions: [{
        type: "forward",
        targetGroupArn: targetGroup.arn,//forwarding the target group here
    }],
});

const attachment = new aws.autoscaling.Attachment("asg-target-group-attachment", {
    autoscalingGroupName: autoScalingGroup.name,
    lbTargetGroupArn: targetGroup.arn,
});

  const dnsRecord = new aws.route53.Record("dns-a-record", {
    zoneId: DNSZone.then(zone => zone.zoneId),
    name: "demo.gloriasingh.me",
    type: "A",
    aliases: [{
        name: loadBalancer.dnsName,
        zoneId: loadBalancer.zoneId,
        evaluateTargetHealth: true,
    }],
});


//lambda role with service as lambda.amazonaws.com
const lambdaRole = new aws.iam.Role("lambdaRole", {assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Sid: "",
        Principal: {
            Service: "lambda.amazonaws.com",
        },
    }],
})});

//lambda role being attached to a lambda policy
const lambdaLogsPolicyAttachment = new aws.iam.RolePolicyAttachment("lambda-logs", {
    role: lambdaRole.name,
    policyArn: lambdaLogsPolicyAttachmentArn,
});

//creating ses policy for sending emails
const sesPolicy = new aws.iam.Policy("sesPolicy", {
    description: "Policy for Lambda function to send emails via SES",
    policy: pulumi.all([]).apply(() => JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Action: ["ses:SendEmail", "ses:SendRawEmail"],
            Effect: "Allow",
            Resource: sesResource
        }]
    }))
});

//ses policy attached with lambda role
const sesPolicyAttachment = new aws.iam.RolePolicyAttachment("sesPolicyAttachment", {
    role: lambdaRole.name,
    policyArn: sesPolicy.arn,
});

const dynamodb_table = new aws.dynamodb.Table("dynamodb_table", {
    attributes: [
        {
            name: "ID",
            type: "S",
        },
    ],
    billingMode: "PROVISIONED",
    hashKey: "ID",
    readCapacity: 20,
    tags: {
        Environment: "production",
        Name: "dynamodb-table-1",
    },
    ttl: {
        attributeName: "timestamp",
        enabled: true,
    },
    writeCapacity: 20,
});

const dynamodb_table_arn = dynamodb_table.arn

// Create a DynamoDB policy document
const dynamodbPolicyDocument = pulumi.output(aws.iam.getPolicyDocument({
    statements: [{
        actions: [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:Scan",
            "dynamodb:Query"
        ],
        resources: ["arn:aws:dynamodb:*:*:table/*"],
        effect: "Allow",
    }],
}));

//create dynamodb policy as json value
const dynamodbPolicy = new aws.iam.Policy("dynamodbPolicy", {
    policy: dynamodbPolicyDocument.apply(document => document.json),
});

// Attach the policy to the IAM Role
const dynamodbPolicyAttachment = new aws.iam.RolePolicyAttachment("dynamodbPolicyAttachment", {
    role: lambdaRole.name,
    policyArn: dynamodbPolicy.arn,
});

//lambda fucntion to handle the lambda file for sending emails and passed with credentials
const lambdaFunc = new aws.lambda.Function("lambdaFunc", {
    code: new pulumi.asset.FileArchive("lambda.zip"),
    role: lambdaRole.arn,
    handler: "index.handler",
    runtime: "nodejs16.x",
    timeout: 300,
    environment: {
        variables: {
            GoogleCredentials: privateKey,
            Google_Bucket : bucketName,
            From_Address: "noreply@demo.gloriasingh.me",
            Dynamo_Db_Table: dynamodb_table.name
        },
    },

});

const lambdaWithSNS = new aws.lambda.Permission("lambdaWithSNS", {
    action: "lambda:InvokeFunction",
    "function": lambdaFunc.name,
    principal: "sns.amazonaws.com",
    sourceArn: snsTopic.arn,
});


const lambda = new aws.sns.TopicSubscription("lambda", {
    topic: snsTopic.arn,
    protocol: "lambda",
    endpoint: lambdaFunc.arn,
});

export default autoScalingGroup
