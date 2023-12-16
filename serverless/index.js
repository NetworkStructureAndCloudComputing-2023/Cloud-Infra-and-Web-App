import AWS from 'aws-sdk';
import { Storage } from '@google-cloud/storage';
import https from 'https';
import logger from './logger.js';
import { v4 as uuidv4 } from 'uuid'; 

export const handler = async (event) => {
    try {
        // Parse SNS message here
        const message = JSON.parse(event.Records[0].Sns.Message);
        logger.info(message);

      
        const githubUrl = message.submissionUrl; //Download from GitHub
        const userEmail = message.user;
        const status = message.status;
        const assignmentId=message.assignmentId;

        logger.info(githubUrl);
        logger.info(userEmail);
        logger.info

        //download function to download the github url and also redirecting it till gets firected to the right URL
        async function downloadFile(fileUrl) {
            return new Promise((resolve, reject) => {
                const getResponse = (response) => {
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        // If redirected, call downloadFile recursively with the new location
                        https.get(response.headers.location, getResponse).on('error', (err) => {
                            logger.error(`Error on HTTP request: ${err.message}`);
                            reject(err);
                        });
                    } else {
                        const contentType = response.headers['content-type'];
                        const data = [];
        
                        logger.info(contentType);
                        
                        response.on('data', (chunk) => data.push(chunk));
                        response.on('end', () => {
                            resolve({
                                fileBuffer: Buffer.concat(data),
                                contentType: contentType//being used for check the content-type of the application
                            });
                        });
                    }
                };
        
                https.get(fileUrl, getResponse).on('error', (err) => {
                    logger.error(`Error on HTTP request: ${err.message}`);
                    reject(err);
                });
            });
        }

        const ses = new AWS.SES({ region: 'us-east-1' }); 

        let emailParams = {
            Source: 'noreply@demo.gloriasingh.me',
            Destination: { 
                ToAddresses: [
                    userEmail
                ] 
            },
            Message: {
                Subject: { 
                    Data: '' 
                },
                Body: { 
                    Text: {
                         Data: '' 
                    } 
                }
            }
        };

        if(status==='Success'){
            const { fileBuffer, contentType } = await downloadFile(githubUrl);
            logger.info(contentType);
        
            if (contentType !== 'application/zip') {
                
                let emailBody = `Dear ${userEmail},\n\n`;
                emailBody += `I hope this email finds you well. I'm writing to inform you about latest submission on Canvas for ${assignmentId}.\n`;
                emailBody += `Submission was done Successfully\n`;
                emailBody += `But unfortunately The provided URL did not point to a valid ZIP file.\n`;
                emailBody += `Please submit the URL again.\n\n`;
                emailBody += `If you have any questions or need help navigating the new features, our support team is here for you. Contact us at noreply@demo.gloriasingh.me.\n`;
                emailBody += `Your privacy and the security of your data are our top priorities. We never share your personal information without your explicit consent\n\n`;
                emailBody += `Thank you for being a valued member of the Canvas community. We are excited to continue serving you with these new enhancements!
                \n\n`;
                emailBody += `Best regards,\n`;
                emailBody += `The Canvas Team`;
                await sendEmail(ses, 'noreply@demo.gloriasingh.me', userEmail, 'Canvas Notification : Invalid URL', emailBody);
                logger.info("Email sent for invalid content type");
                return;
            }
    
            logger.info("File downloaded from GitHub successfully");
    
            const timestamp = new Date().toISOString(); // format: YYYY-MM-DDTHH:mm:ss.sssZ
            const filenameWithTimestamp = `filename-${userEmail}-${timestamp}.zip`;
        
            // Load Google Cloud credentials from environment variable
            const googleCredsBase64 = process.env.GoogleCredentials;
            const googleCredsJson = Buffer.from(googleCredsBase64, 'base64').toString('utf-8');
            logger.info(googleCredsJson);
    
            // Initialize Google Cloud Storage with credentials
            const storage = new Storage({
                credentials: JSON.parse(googleCredsJson),
            });
            logger.info(storage);
    
            const bucketName = process.env.Google_Bucket;
            logger.info(bucketName);
    
            await storage.bucket(bucketName).file(filenameWithTimestamp).save(fileBuffer);
            const gcsFileUrl = `https://storage.googleapis.com/${bucketName}/${filenameWithTimestamp}`;
            logger.info(`File uploaded to GCS: ${gcsFileUrl}`);
            let emailBody = `Dear ${userEmail},\n\n`;
            emailBody += `I hope this email finds you well. I'm writing to inform you about latest submission on Canvas for ${assignmentId}.\n`;
            emailBody += `Your Submission was successfully done.\n`;
            emailBody += `Here is your GCP bucket path : ${filenameWithTimestamp}\n\n`;
            emailBody += `If you have any questions or need help navigating the new features, our support team is here for you. Contact us at noreply@demo.gloriasingh.me.\n`;
            emailBody += `Your privacy and the security of your data are our top priorities. We never share your personal information without your explicit consent\n\n`;
            emailBody += `Thank you for being a valued member of the Canvas community. We are excited to continue serving you with these new enhancements!
            \n\n`;
            emailBody += `Best regards,\n`;
            emailBody += `The Canvas Team`;
            await sendEmail(ses, 'noreply@demo.gloriasingh.me', userEmail, 'Canvas Notification : Sucessful Submission', emailBody);
            logger.info("Email sent successfully for status:", status);
             
            // catch (error) {
            //     logger.error("Error uploading file to Google Cloud Storage:", error);
            //     await sendEmail(ses, 'noreply@demo.gloriasingh.me', userEmail, 'Canvas Notification : Upload Failure', 'There was an error uploading your file to GCS.');
            //     logger.error("Error sending email:", error);
            //     return;
            // }
        }
        
        else{
            logger.error("Error uploading file to Google Cloud Storage:", error);
            let emailBody = `Dear ${userEmail},\n\n`;
            emailBody += `I hope this email finds you well. I'm writing to inform you about latest submission on Canvas for Assignment - ${assignmentId}.\n`;
            emailBody += `Your Submission has failed.\n`;
            emailBody += `The reason for the failure: ${status}\n\n`;
            emailBody += `If you have any questions or need help navigating the new features, our support team is here for you. Contact us at noreply@demo.gloriasingh.me.\n`;
            emailBody += `Your privacy and the security of your data are our top priorities. We never share your personal information without your explicit consent\n\n`;
            emailBody += `Thank you for being a valued member of the Canvas community. We are excited to continue serving you with these new enhancements!
            \n\n`;
            emailBody += `Best regards,\n`;
            emailBody += `The Canvas Team`;
            await sendEmail(ses, 'noreply@demo.gloriasingh.me', userEmail, 'Canvas Notification : Upload Failure', emailBody);
            logger.error("Error sending email:", error);
            return;
        }
      

        // Save record to DynamoDB
        const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });
        const tableName = process.env.Dynamo_Db_Table; 
        const dbParams = {
            TableName: tableName, 
            Item: {
                ID: uuidv4(), // Unique identifier for the email record
                recipient: userEmail,
                dateSent: new Date().toISOString(),
                message: 'Email sent regarding file upload to GCS.'
            }
        };
         
        try {
            await dynamoDb.put(dbParams).promise();
            logger.info("Items saved in DynamoDB");
        } catch (error) {
            logger.error("Error saving items to DynamoDB:", error);
        }
    } 
    catch (error) {
        logger.error("Error in Lambda function:", error);
    }
};


async function sendEmail(ses, source, recipient, subject, bodyText) {
    const emailParams = {
        Source: source,
        Destination: { ToAddresses: [recipient] },
        Message: {
            Subject: { Data: subject },
            Body: { Text: { Data: bodyText } }
        }
    };

    return ses.sendEmail(emailParams).promise();
}