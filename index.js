const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const ObjectId = require("mongodb").ObjectId;
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eep6yze.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UNAUTHORISED" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}
async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("beauty_salon").collection("services");
    const bookingCollection = client.db("beauty_salon").collection("bookings");
    const userCollection = client.db("beauty_salon").collection("users");

    const expertCollection = client.db("beauty_salon").collection("expert");

    const reviewCollection = client.db("beauty_salon").collection("review");
    //  const expertCollection=client.db('beauty_salon').collection('users');

    /**
     * API Naming convention
     * app.get('/booking) //get all
     * app.get('/booking) //specific id all
     * app.post('/booking) //new booking
     * app.patch('/booking) //update
     * app.delete('/booking) //delete
     */

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requensterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requensterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbiden" });
      }
    };

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({ name: 1 });
      const services = await cursor.toArray();
      res.send(services);
    });

    // app.get('/service', async (req, res) => {

    //   const query = {};
    //   const cursor = serviceCollection.find(query).project({ name: 1 })
    //   const services = await cursor.toArray();
    //   res.send(services);

    // })

    //for review

    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      console.log(review);
      res.send(review);
    });
    app.get("/review", async (req, res) => {
      const query = {};
      const cursor = await reviewCollection.find(query);
      const review = await cursor.toArray();
      res.send(review);
    });

    app.delete("/review/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.post("/user", async (req, res) => {
      const data = req.body;
  
      const result = await userCollection.insertOne(data);
      res.send(result);
    });
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email)
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      //  const user=req.body;
      //const requester= req.decoded.email;
      //const requensterAccount=await userCollection.findOne({email:requester})
      // if(requensterAccount.role==='admin')
      //{
      const filter = { email: email };

      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);

      res.send(result);
      // }
      // else{
      //   res.status(403).send({message :'forbiden'})
      // }
    });
    //for generate a jwt
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };

      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    app.get("/available", async (req, res) => {
      const selected = req.query.selected; //selected means date
      const services = await serviceCollection.find().toArray();
      const query = { selected: selected };

      const bookings = await bookingCollection.find(query).toArray();

      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );
        const bookedSlots = serviceBookings.map((book) => book.slot);
        //service.booked=booked;
        const avaiable = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        service.slots = avaiable;
      });

      res.send(services);
    });

    //get those data which i post for booking

    app.get("/booking", async (req, res) => {
      const clint = req.query.clint;
      // const authorization=req.headers.authorization;
      // const decodedEmail = req.decoded.email;
      // if (clint === decodedEmail) {
      //   const query = { clint: clint };
      //   const bookings = await bookingCollection.find(query).toArray();
      //   return res.send(bookings);
      // }
      // // console.log('auth header',authorization)
      // else {
      //   return res.status(403).send({ message: "forbidden acces" });
      // }
      const query = { clint: clint };
      const bookings = await bookingCollection.find(query).toArray();
      return res.send(bookings);
    });
    app.get("/allbooking", async (req, res) => {
     
    
      const bookings = await bookingCollection.find().toArray();
      return res.send(bookings);
    });

    //for post data on booking api
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      //const result=await bookingCollection.insertOne(booking)
      //  res.send(result);
      const query = {
        treatment: booking.treatment,
        selected: booking.selected,
        clint: booking.clint,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }

      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });

    // app.post('/expert',async(req,res)=>{
    //    const expert=req.body;
    //    const result=await expertCollection.insertOne(expert)
    //  res.send(result);
    //   })

    /*
    app.get('/expert',verifyJWT,verifyAdmin,async(req,res)=>
    {
    const expert=await expertCollection.findOne().toArray();
    res.send(expert)
    
    }) */

    app.get("/expert",  async (req, res) => {
      const expert = await expertCollection.find().toArray();
      res.send(expert);
    });

    app.post("/expert",  async (req, res) => {
      const expert = req.body;
      const result = await expertCollection.insertOne(expert);
      res.send(result);
    });
    app.delete("/expert/:email",async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await expertCollection.deleteOne(filter);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello from our beauty salon");
});

app.listen(port, () => {
  console.log(`beauty app listening on port ${port}`);
});
