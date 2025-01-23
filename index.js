const express = require('express')
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')

const app = express()
const port = 5500

// middleware
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://foody-cart-6c36f.web.app',
        'https://foody-cart-6c36f.firebaseapp.com'
    ],
    credentials: true,
}))

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token

    console.log('token is', token);

    if (!token) {
        return res.status(401).send({ messege: 'unauthorized access' })
    }

    // verify token
    jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ messege: "unauthorized access" })
        }
        req.user = decoded
        next()
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lkytz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // await client.connect();
        const mainDB = client.db('FoodSharing')

        // auth related api .. jwt 
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.JWT_TOKEN, {
                expiresIn: '18h'
            });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                // secure: false
            })
                .send({ successs: true })
        })

        app.post('/logout', (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
                .send({ logOutSuccess: true })
        })


        // app.post('/logout', async (req, res) => {
        //     const user = req.body;
        //     console.log('logging out', user);
        //     res
        //         .clearCookie('token', { maxAge: 0, sameSite: 'none', secure: true })
        //         .send({ success: true })
        // })

        // create a new collection in the existing database
        const database = mainDB.collection('AllFoods')
        app.post('/add-foods', async (req, res) => {
            const user = req.body
            const result = await database.insertOne(user)
            res.send(result)
        })

        app.get('/all-foods', async (req, res) => {
            const cursor = database.find()
            const result = await cursor.toArray()
            res.send(result)
        })


        // jwt token varified
        app.get('/manage-all-foods', verifyToken, async (req, res) => {
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const email = req.query.email
            const query = { 'Donator.Email': email }

            const cursor = database.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        // send single food details
        app.get('/food/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await database.findOne(query)
            res.send(result)
        })

        // update single food details
        app.put(`/update-food/:id`, async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedFood = req.body;

            const food = {
                $set: {
                    FoodName: updatedFood.FoodName,
                    FoodImage: updatedFood.FoodImage,
                    FoodQuantity: updatedFood.FoodQuantity,
                    PickupLocation: updatedFood.PickupLocation,
                    ExpiredDateTime: updatedFood.ExpiredDateTime,
                    AdditionalNotes: updatedFood.AdditionalNotes,
                    Donator: {
                        Name: updatedFood.Donator.Name,
                        Email: updatedFood.Donator.Email,
                        Image: updatedFood.Donator.Image
                    },
                    FoodStatus: updatedFood.FoodStatus
                }
            }
            const result = await database.updateOne(filter, food, options)
            res.send(result)
        })

        // delete single food 
        app.delete('/food/:deleteByID', async (req, res) => {
            const id = req.params.deleteByID
            const query = { _id: new ObjectId(id) }
            const result = await database.deleteOne(query)
            res.send(result)
        })

        // my food request database..
        const foodRequestDB = mainDB.collection('My-food-request')

        app.post('/food-request', async (req, res) => {
            const foodRequest = req.body
            const result = await foodRequestDB.insertOne(foodRequest)
            res.send(result)
        })

        // jwt token varified
        app.get('/food-request', verifyToken, async (req, res) => {

            if (req.user.email !== req.query.email) {
                return res.status(403).send({ messege: 'forbidden access' })
            }

            const email = req.query.email
            const query = { RequestedUser: email }
            const cursor = foodRequestDB.find(query)
            const results = await cursor.toArray()

            res.send(results)
        })

        app.delete(`/food-request/:id`, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const deletedRequestedFood = await foodRequestDB.deleteOne(query)
            res.send(deletedRequestedFood)
        })

    } finally {
        // await client.close();
        console.log('MongoDB running.....');
    }
}
run().catch(error => console.log(error));

app.get('/', (req, res) => {
    res.send('Welcome users')
})

app.listen(port, () => {
    console.log(`Server running on port ${port}....`)
})
