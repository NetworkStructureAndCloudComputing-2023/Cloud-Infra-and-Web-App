import express from 'express'
import bodyParser from 'body-parser'
import {sequelize,dbconnect} from './src/models/sequel.js'
import Documents from './src/models/document.js'
import Users from './src/models/user.js'
import results from './src/utils/addCsvUsers.js'
import authenticate from './src/utils/basicAuth.js'
import pool from './src/config/healthConfig.js'
import logger from './src/utils/logger.js'
import statsD from 'node-statsd'
import Submission from './src/models/submission.js'
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config()

const app= express()
app.use(bodyParser.urlencoded({ extended:false }))
app.use(express.json())

sequelize.sync({
    
})
.then((result)=>{
    results.forEach(async (userObj)=>{
        const user= await Users.create(userObj);
    })
}) 

.catch((err)=>{
  logger.error(err)
})

const statsDMetrics= new statsD({
  host:"localhost",
  port: 8125,
});



//configure AWS SNS

AWS.config.update({region: 'us-east-1'});

// Create an SNS instance
const sns = new AWS.SNS();

app.get('/v2/authenticated', authenticate, (req, res) => {
    // only if authentication is successful
    res.send('Authenticated endpoint');
  });

// GET endpoint to retrieve all assignments
  app.get('/v2/assignments',authenticate, async (req, res) => {
    try {
      statsDMetrics.increment(`api.assignments.get.calls`)
      logger.info('getting all the assignment details')
      const assignments = await Documents.findAll({
        attributes :['id', 'name','points','num_of_attemps','deadline', 'assignment_created', 'assignment_updated']
      });
      return res.status(200).json(assignments);
    } 
    catch (error) {
      if (!res.headersSent) {
        logger.error('Error retrieving assignments:', error);
        return res.status(500).send('Internal Server Error');
      }
    }
  });

  // GET endpoint to retrieve an assignment by ID
  app.get('/v2/assignments/:id', authenticate, async (req, res) => {
    const id = req.params.id;
    try {
      // Retrieve the assignment by ID from the database
      statsDMetrics.increment(`api.assignments.getbyID.calls`)
      logger.info('getting assignment details by ID')
        const assignment = await Documents.findByPk(id,{
        attributes :['id', 'name','points','num_of_attemps','deadline','assignment_created', 'assignment_updated']
      });
      if (!assignment) {
        return res.status(404).send('Assignment not found');
      }
      // Return the assignment as a JSON response
      return res.status(200).json(assignment);
    } 

    catch (error) {
      if (!res.headersSent) {
        logger.error('Error retrieving assignments:', error);
        return res.status(500).send('Internal Server Error');
      }
    }
  });


  app.patch('/v2/assignments', (req, res) => {
    res.status(405).send('Method Not Allowed');
    logger.error('patch method not allowed')
  });

  app.patch('/v2/assignments/:id', (req, res) => {
    res.status(405).send('Method Not Allowed');
    logger.error('patch method not allowed')
  });

  app.post('/v2/assignments/:id', (req, res) => {
    res.status(405).send('Method Not Allowed. Please use post without parameters, use this for post method: /api/assignments');
  });


  app.post('/v2/assignments', authenticate, async (req, res) => {
    

      logger.info('creating assignments with fields')
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        logger.warn('No data provided in request body.');
        return res.status(400).send('No data provided.');
      }
    
      statsDMetrics.increment(`api.assignments.post.calls`)
      const username=req.name
      let name = req.body.name;
      name = name.trim();
    
      const { points, num_of_attemps,deadline } = req.body;

      try {
        const existingAssignment = await Documents.findOne({ where: { name: name } });
        if (existingAssignment) {
            logger.warn('An assignment with the same name already exists.');
            return res.status(400).send('An assignment with the same name already exists.');
        }
      } catch (error) {
          logger.error('Error checking for existing assignment:', error);
          return res.status(500).send('Internal Server Error');
      }

      if (!name || typeof name!='string') {
        logger.warn('Please provide valid name for the assignment: which is string, this is a mandatory field')
        return res.status(400).send('Please provide valid name for the assignment: which is string, this is a mandatory field'); 
      }
      if (!deadline ||isNaN(Date.parse(deadline))) {
        logger.warn('Please provide valid deadline for the assignment: which is Date, this is a mandatory field')
        return res.status(400).send('Please provide valid deadline for the assignment: which is Date, this is a mandatory field');
      } 
      if (!num_of_attemps || !Number.isInteger(num_of_attemps) || num_of_attemps < 1) {
        logger.warn('Please provide a valid number of attempts for the assignment: a positive integer, this is a mandatory field')
        return res.status(400).send('Please provide a valid number of attempts for the assignment: a positive integer, this is a mandatory field');
      }
        // Validate the assignment points
        if (!points || !Number.isInteger(points) || points < 1 || points > 10) {
          logger.warn('Assignment points must be a non-float number between 1 and 10.')
          return res.status(400).send('Assignment points must be a non-float number between 1 and 10.');
      }
      
      Documents.create({
          name :name,
          points,
          num_of_attemps,
          deadline,
          createdBy:username, // Store the username of the user who created the assignment
      })
    
      .then((assignment) => {
          const { createdBy, ...responseWithoutCreatedBy } = assignment.toJSON();
          res.status(201).json(responseWithoutCreatedBy);
          logger.info('created assignment');
      })

      .catch((error) => {
        logger.error('Error creating assignment:', error);
        res.status(500).send('Internal Server Error');
      });
  });


  // PUT endpoint for updating assignments
  app.put('/v2/assignments/:id', authenticate, async (req, res) => {

      logger.info('Update request received for assignments')
      statsDMetrics.increment(`api.assignments.put.calls`)
      const username  = req.name;
      const id = req.params.id;

      if (!req.body || Object.keys(req.body).length === 0) {
        logger.warn('No update data provided in request body.');
        return res.status(400).send('No update data provided.');
    }
    
      const { name, points, num_of_attemps,deadline } = req.body;

    
      try {
        // Find the assignment by ID
        const document = await Documents.findByPk(id);
    
        if (!document) {
          return res.status(404).send('Assignment not found');
        }
    
        // Check if the authenticated user is the owner of the assignment
        if (document.createdBy !== username) {
          logger.warn('Access denied. You do not own this assignment.')
          return res.status(403).send('Access denied. You do not own this assignment.');
        }
        // Validate the assignment name
        if (!name || typeof name!='string') {
          logger.warn('Please provide valid name for the assignment: which is string, this is a mandatory field')
          return res.status(400).send('Please provide valid name for the assignment: which is string, this is a mandatory field'); 
        }
        // Validate the time formats
        if (!deadline ||isNaN(Date.parse(deadline))) {
          logger.warn('Please provide valid deadline for the assignment: which is Date, this is a mandatory field')
          return res.status(400).send('Please provide valid deadline for the assignment: which is Date, this is a mandatory field');
        } 
        // Validate the number of attempts
        if (!num_of_attemps || !Number.isInteger(num_of_attemps) || num_of_attemps < 1) {
          logger.warn('Please provide a valid number of attempts for the assignment: a positive integer, this is a mandatory field')
          return res.status(400).send('Please provide a valid number of attempts for the assignment: a positive integer, this is a mandatory field');
        }
          // Validate the assignment points
          if (!points || !Number.isInteger(points) || points < 1 || points > 10) {
            logger.warn('Assignment points must be a non-float number between 1 and 10.')
            return res.status(400).send('Assignment points must be a non-float number between 1 and 10.');
        }
        else{
          document.name = name;
          document.points = points;
          document.deadline=deadline;
          document.num_of_attemps=num_of_attemps;
        }

        await document.save()

        //destructuring createdBy from the response
        const{createdBy, ...responseWithoutCreatedBy}=document.toJSON();
        logger.info('new record updated')
        return res.status(204).json(responseWithoutCreatedBy);
        
      } catch (error) {
        logger.error('Error updating assignment:', error);
        return res.status(500).send('Internal Server Error');
      }
    });

  // DELETE endpoint for deleting assignments
  app.delete('/v2/assignments/:id', authenticate, async (req, res) => {
    const username  = req.name;
    const id =req.params.id;
    statsDMetrics.increment(`api.assignments.delete.calls`)

    if (req.body && Object.keys(req.body).length > 0) {
      logger.warn('Request body should not be provided for DELETE operation.');
      return res.status(400).send('Request body should not be provided for DELETE operation.');
  }

    try {
      // Find the assignment by ID
      const document = await Documents.findByPk(id);

      if (!document) {
        return res.status(404).send('Assignment not found');
      }

      // Check if the authenticated user is the owner of the assignment
      if (document.createdBy !== username) {
        return res.status(403).send('Access denied. You do not own this assignment.');
      }

        // Check for any submissions associated with this assignment
        const submissionsExist = await Submission.count({
          where: { assignment_id: id }
      });

      if (submissionsExist > 0) {
          logger.warn('Cannot delete assignment as there are submissions linked to it.');
          return res.status(400).send('Deletion not allowed: There are submissions linked to this assignment.');
      }

      // Delete the assignment
      await document.destroy();
      return res.status(204).send(); // No content
      
    } catch (error) {
      logger.info('Error deleting assignment:', error);
      return res.status(500).send('Internal Server Error');
    }
  });

// POST endpoint for assignment submission
app.post('/v2/assignments/:assignmentId/submission', authenticate, async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
    logger.warn('No data provided in request body.');
    return res.status(400).send('No data provided.');
  }

  const username = req.name; 
  const { assignmentId } = req.params;
  const { submission_url } = req.body;

  if (!req.body || Object.keys(req.body).length === 0) {
    logger.warn('No update data provided in request body.');
    return res.status(400).send('No update data provided.');
}

  // Validate submission_url
  if (!submission_url) {
    logger.error('Submission URL is required')
      return res.status(400).send('Submission URL is required'); 
  }

  // Check if submission_url is a valid URL
  try {
      new URL(submission_url);
  } catch (error) {
    logger.error('Invalid submission URL')
      return res.status(400).send('Invalid submission URL');
  }

  try {
      const assignment = await Documents.findByPk(assignmentId);
      let status;

      if (!assignment) {
          status = 'AssignmentNotFound';
          sendSnsMessage(username, submission_url, status); // Helper function to send SNS message
          logger.error('Assignment not found')
          return res.status(404).send('Assignment not found');
      }

      if (new Date(assignment.deadline) < new Date()) {
          status = 'DeadlinePassed';
          sendSnsMessage(username, submission_url, status);
          logger.error('Assignment deadline has passed')
          return res.status(403).send('Assignment deadline has passed');
      }

      const submissionsCount = await Submission.count({
          where: { name: username, assignment_id: assignmentId }
      });

      if (submissionsCount >= assignment.num_of_attemps) {
          status = 'MaxAttemptsExceeded';
          sendSnsMessage(username, submission_url, status);
          logger.error('Maximum number of attempts exceeded')
          return res.status(403).send('Maximum number of attempts exceeded');
      }

      const submission = await Submission.create({
          name: username,
          assignment_id: assignmentId,
          submission_url,
          submission_date: new Date(),
          submission_updated: new Date()
      });

      status = 'Success';
      sendSnsMessage(username, submission_url,assignmentId, status);

      return res.status(201).json({
          id: submission.id,
          assignment_id: submission.assignment_id,
          submission_url: submission.submission_url,
          submission_date: submission.submission_date,
          submission_updated: submission.submission_updated
      });

  } catch (error) {
      logger.error('Error in submission:', error);
      sendSnsMessage(username, submission_url,assignmentId, 'Failure');
      return res.status(500).send('Internal Server Error');
  }
});

function sendSnsMessage(username, submissionUrl,assignmentId, status) {
  const snsTopicArn = process.env.snsTopicArn;
  if (!snsTopicArn) {
      logger.error('SNS Topic ARN is not defined in environment variables');
      return;
  }

  const message = {
      user: username,
      submissionUrl: submissionUrl,
      assignmentId:assignmentId,
      status: status
  };

  const params = {
      Message: JSON.stringify(message),
      TopicArn: snsTopicArn
  };

  sns.publish(params, (err, data) => {
      if (err) {
          logger.error('Error publishing to SNS:', err);
      } else {
          logger.info('Successfully published status to SNS:', data);
      }
  });
}

async function isZipFile(url) {
  return new Promise((resolve, reject) => {
      const options = {
          method: 'HEAD',
      };

      https.request(url, options, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
              // Follow redirect
              return resolve(isZipFile(response.headers.location));
          } else {
              resolve(response.headers['content-type'] === 'application/zip');
          }
      }).on('error', (err) => {
          reject(err);
      }).end();
  });
}


app.get("/healthz", (req,res) => {
  statsDMetrics.increment(`api.healthz.calls`)
  pool.getConnection((error,conn)=>{

      if(error){
          logger.error('connection error')
          res.set('Cache-Control', 'no-cache')
          res.status(503);
          res.send();
          
      }
      else{
          if((parseInt(req.header('Content-Length')||'0',10))===0 && Object.keys(req.query).length === 0){
              logger.info('success')
              res.set('Cache-Control', 'no-cache')
              res.status(200);
              res.send();
              
          }
          else{    
              res.set('Cache-Control', 'no-cache')
              logger.error('bad request')
              res.status(400);
              res.send();
          
          }
          conn.release();
      } 
  });   
})


app.all("/healthz",async(req,res) => {
  statsDMetrics.increment(`api.healthz.all.calls`)
  pool.getConnection((error,conn)=>{
      if(error){
          logger.error('connection error')
          res.set('Cache-Control', 'no-cache')
          res.status(503);
          res.send();
          
      }
      else  if(req.method!="GET"){
          logger.error('method not allowed')
          res.status(405)
          res.set('Cache-Control', 'no-cache')
          res.send()  
             
      } 
  });
 
})

app.listen(8080, () => {
    logger.info(`Server is running on port 8080`);
  });


export default app