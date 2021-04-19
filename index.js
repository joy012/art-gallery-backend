const express = require('express');
const request = require('request');
const cors = require('cors');
const MongoClient = require('mongodb').MongoClient
const ObjectId = require('mongodb').ObjectId;
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const fileUpload = require('express-fileupload');
const admin = require('firebase-admin');
const utf8 = require('utf8');
const serviceAccount = require("./config/tonu-s-creation-firebase-adminsdk-nfdxx-a57b06f358.json");


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://tonu-s-creation.firebaseio.com"
});


const uri = `mongodb+srv://tonusCreation:50114400@cluster0.ukskk.mongodb.net/tonus-creation?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const app = express();




app.use(cors());
app.use(fileUpload())
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: false, parameterLimit: 50000 }));


const port = 2259;

app.get('/', (req, res) => {
    res.send('Hello')
})

client.connect(err => {
    const productCollection = client.db("tonus-creation").collection("products");
    const orderCollection = client.db("tonus-creation").collection("orders");
    const adminCollection = client.db("tonus-creation").collection("admin");

    // all product api
    app.get('/products', (req, res) => {
        productCollection.find({})
            .toArray((err, documents) => {
                res.send(documents);
            })
    })

    app.post('/addProduct', (req, res) => {
        const img = req.files.productImg;
        const name = req.body.name;
        const paper = req.body.paper;
        const size = req.body.size;
        const price = req.body.price;
        const borderColor = req.body.borderColor;
        const borderSize = req.body.borderSize;
        const artType = req.body.artType;
        const filePath = `${__dirname}/products/${img.name}`;

        img.mv(filePath, err => {
            if (err) {
                console.log(err);
            }
            const newImg = fs.readFileSync(filePath);
            const encImg = newImg.toString('base64');

            const image = {
                contentType: img.mimetype,
                size: img.size,
                img: Buffer.from(encImg, 'base64')
            }

            productCollection.insertOne({ name, paper, size, price, borderColor, borderSize, image, artType })
                .then(result => {
                    res.send(result.insertedCount > 0)
                    fs.remove(filePath, err => {
                        if (err) {
                            console.log(err);
                        }
                    })
                })
        })
    })

    app.delete('/deleteProduct/:id', (req, res) => {
        console.log(req)
        productCollection.deleteOne({ _id: ObjectId(`${req.params.id}`) })
            .then(result => {
                console.log(result)
                res.send(result.deletedCount > 0)
            })
    })



    // all order api
    app.get('/allOrder', (req, res) => {
        orderCollection.find({})
            .toArray((err, documents) => {
                res.send(documents);
            })
    })

    app.patch('/updateOrder', (req, res) => {
        orderCollection.updateOne(
            { _id: ObjectId(req.query.id) },
            {
                $set: { status: req.body.status }
            })
            .then(result => {
                res.send(result.modifiedCount > 0);
            })
    })

    app.post('/addOrder', (req, res) => {
        const order = req.body;
        const name = order.name;
        const address = order.address;
        const email = order.email;
        const cart = order.cart;
        const city = order.city;
        const mobile = order.mobile;
        const paymentMethod = order.paymentMethod;
        const totalPayment = order.paymentAmount;
        const status = order.status;
        const txId = paymentMethod === 'Bkash' ? order?.txId : " ";
        const list = cart.map((pd, index) => {
            const name = utf8.encode(pd.name);
            const productMsg = `Product No: ${index + 1}
ArtWork: ${pd.artType}
Name: ${name}
Size: ${pd.size}
Paper: ${pd.paper}
Border Size: ${pd.borderSize}
Border Color: ${pd.borderColor}
Price: ${pd.price}\n\n`

            return productMsg

        })
        let msg = '';
        for (let i = 0; i < list.length; i++) {
            msg += list[i];
        }

        const userMessage = `Hey Tonu,\nNew Order Arrived!!\n\nCustomer Details:\nName: ${name}\nEmail: ${email}\nMobile: ${mobile}\nCity: ${city}\nAddress: ${address}\nPayment Method: ${paymentMethod}\nTransaction Id: ${txId}\nTotal Payment: BDT ${totalPayment}`

        const orderMessage = `Order Details:\n\n${msg}Please check your BKASH and login to your admin panel to approve this order. Set the status to 'ON GOING' to let the customer know about his order progress.`

        orderCollection.insertOne({ name, address, email, mobile, city, paymentMethod, totalPayment, txId, status, cart })
            .then(result => {
                if (result.insertedCount > 0) {
                    request(`https://api.telegram.org/bot1515370605:AAFFVIa8HYKBMuSkVwCYTBRcIFz_fhp4g7I/sendMessage?chat_id=974639281&text=${userMessage}`, function (error, response, body) {
                        console.log(body);
                    });
                    request(`https://api.telegram.org/bot1515370605:AAFFVIa8HYKBMuSkVwCYTBRcIFz_fhp4g7I/sendMessage?chat_id=974639281&text=${orderMessage}`, function (error, response, body) {
                        console.log(error);
                    });


                    request(`https://api.telegram.org/bot1515370605:AAFFVIa8HYKBMuSkVwCYTBRcIFz_fhp4g7I/sendMessage?chat_id=1235711022&text=${userMessage}`, function (error, response, body) {
                        console.log(body);
                    });
                    request(`https://api.telegram.org/bot1515370605:AAFFVIa8HYKBMuSkVwCYTBRcIFz_fhp4g7I/sendMessage?chat_id=1235711022&text=${orderMessage}`, function (error, response, body) {
                        console.log(error);
                    });

                    res.send(result.insertedCount > 0)
                }
            })
    })

    app.get('/userOrder', (req, res) => {
        const bearer = req.headers.authorization;
        if (bearer && bearer.startsWith('Bearer ')) {
            const idToken = bearer.split(' ')[1];
            admin.auth().verifyIdToken(idToken)
                .then(function (decodedToken) {
                    const tokenEmail = decodedToken.email;
                    const queryEmail = req.query.email;
                    if (tokenEmail === queryEmail) {
                        orderCollection.find({ email: queryEmail })
                            .toArray((err, documents) => {
                                res.status(200).send(documents);

                            })
                    }
                    else {
                        res.status(401).send('Un-Authorized Access!!')
                    }
                }).catch(function (error) {
                    res.status(401).send('Un-Authorized Access!!')
                });
        }
        else {
            res.status(401).send('Un-Authorized Access!!')
        }
    })

    app.delete('/deleteOrder', (req, res) => {
        orderCollection.deleteOne({ _id: ObjectId(req.query.id) })
            .then(result => {
                res.send(result.deletedCount > 0)
            })
    })


    // all admin api
    app.get('/getAdmin', (req, res) => {
        const email = req.query.email;
        adminCollection.find({ email: email })
            .toArray((err, documents) => {
                res.send(documents);
            })
    })

    app.post('/addAdmin', (req, res) => {
        const admin = req.body;
        adminCollection.insertOne(admin)
            .then(result => {
                res.send(result.insertedCount > 0)
            })
    })

});

app.listen(process.env.PORT || port);
