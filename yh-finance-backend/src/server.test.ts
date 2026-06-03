import request from 'supertest';
import mongoose from 'mongoose';
import app from './server'; 

let activeToken = ''; 
const testUserEmail = `test_${Date.now()}@example.com`; 

describe('MERN Backend API Tests', () => {

    afterAll(async () => {
        await mongoose.connection.close();
    });

    it('1. Should register a new user successfully', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({ email: testUserEmail, password: 'securepassword123' });
        
        expect(response.statusCode).toEqual(201);
        expect(response.body).toHaveProperty('message', 'User registered successfully!');
    });

    it('2. Should log in the user and return a JWT token', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: testUserEmail, password: 'securepassword123' });
        
        expect(response.statusCode).toEqual(200);
        expect(response.body).toHaveProperty('token');
        
        activeToken = response.body.token; 
    });

    it('3. Should block access to the Top Stocks route if no token is provided', async () => {
        const response = await request(app).get('/api/stock/top-stocks'); 
        
        expect(response.statusCode).toEqual(401);
        expect(response.body.error).toContain('Access Denied');
    });

    it('4. Should return a 404 error if the user searches for a fake stock ticker', async () => {
        const fakeTicker = 'ZZZZZZZ';
        const response = await request(app)
            .get(`/api/stock/search/${fakeTicker}`)
            .set('Authorization', `Bearer ${activeToken}`); 
        
        expect(response.statusCode).toEqual(404);
        expect(response.body.error).toContain(`Could not load data for ${fakeTicker}`);
    }, 10000); 

    it('5. Should fetch the top 10 stocks successfully when authenticated', async () => {
        const response = await request(app)
            .get('/api/stock/top-stocks')
            .set('Authorization', `Bearer ${activeToken}`); 
        
        expect(response.statusCode).toEqual(200);
        expect(Array.isArray(response.body)).toBeTruthy();
        expect(response.body.length).toBeGreaterThan(0);
    }, 15000); 
});