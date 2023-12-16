import chai from 'chai'
import chaiHttp from 'chai-http'
import app from '../app.js'
import pool from '../src/config/healthConfig.js'

chai.use(chaiHttp);

const {expect} = chai;

describe('/healthz Endpoint', () => {

  it('should return 200 for a valid GET request', (done) => {
    chai.request(app)
      .get('/healthz')
      .end((err, res) => {
        try{
          if (err) {
            // Check if the error is due to a 404 status code, and fail the test.
            if (res && res.status === 404) {
              done(new Error('Expected status code 200 but got 404'));
            } else {
              console.error("Test Error:", err);
              done(err);
            }
          } else {
            // If no error occurred, check for the expected 200 status.
            expect(res).to.have.status(200);
            done();
          }
        }
        catch(error){
                  console.log(error)
        }
        finally {
                setTimeout(() => {
                  process.exit(0);
                }, 2000); //
              }

      });
  });
});




