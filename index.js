const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const verifyJwt = (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    return res.status(401).send({ message: "Forbidden access" });
  }

  const token = authorizationHeader.split(" ")[1];

  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  if (!req.decoded || !req.decoded.email) {
    return res.status(403).send({ message: "Unauthorized access" });
  }
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  if (!user || user.role !== "admin") {
    return res.status(403).send({ message: "Unauthorized access" });
  }
  next();
};

const uri = `mongodb+srv://${process.env.USER_NAME}:${encodeURIComponent(
  process.env.USER_PASS
)}@mern.atgqzad.mongodb.net/?retryWrites=true&w=majority&appName=MERN`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  connectTimeoutMS: 30000,
  socketTimeoutMS: 60000,
});

let userCollection;
let menuCollection;
let reviewCollection;
let cartsCollection;

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const db = client.db("bistroDb");
    userCollection = db.collection("user");
    menuCollection = db.collection("menu");
    reviewCollection = db.collection("reviews");
    cartsCollection = db.collection("carts");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_TOKEN, {
        expiresIn: "6d",
      });
      res.send({ token });
    });


// payment Gateway /////////

// app.post('/create-payment-intent', verifyJwt, async (req, res) => {
//   try {
//     const { price } = req.body;
//     if (!price || isNaN(price) || price <= 0) {
//       return res.status(400).send({ error: "Invalid price provided" });
//     }
//     const total = Math.round(price * 100); 
//     const minAmount = 50; 
//     if (total < minAmount) {
//       return res.status(400).send({ error: `The amount must be at least ${minAmount / 100} USD` });
//     }

//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: total,
//       currency: "usd",
//       payment_method_types: ["card"],
//     });

//     res.send({
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (error) {
//     console.error("Error creating payment intent:", error);
//     res.status(500).send({ error: "Internal server error" });
//   }
// });


    app.get("/users/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }

      const user = await userCollection.findOne({ email });
      const admin = user?.role === "admin";
      res.send({ admin });
    });

    app.get("/user", verifyJwt, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch("/user/admin/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid user ID format" });
      }

      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: "admin" } };
      const result = await userCollection.updateOne(filter, updateDoc, {
        upsert: true,
      });
      res.send(result);
    });

    app.delete("/user/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid user ID format" });
      }

      const filter = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });

    app.post("/user", async (req, res) => {
      const user = req.body;
      const oldUser = await userCollection.findOne({ email: user.email });
      if (oldUser) {
        return res.send({ message: "User already created", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });



    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.patch('/menu/:id',async (req,res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = {_id: new ObjectId (id)}
      const updateDoc ={
        $set:{
        name:item.name,
        category:item.category,
        price:item.price,
        recipe:item.recipe,
        image:item.image

        }
      }
      const result = await menuCollection.updateOne(filter,updateDoc)
      res.send(result)
    })

    app.get('/menu/:id', async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid menu item ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: "Menu item not found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error retrieving menu item:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post("/menu", verifyJwt, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/menu/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      try {
        const result = await menuCollection.deleteOne(filter);
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Menu item not found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error deleting menu item:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.get("/carts", verifyJwt, async (req, res) => {
      const email = req.query.email;
      const result = await cartsCollection.find({ email }).toArray();
      res.send(result);
    });


      // papieLine /// 
      app.get('/admin-stats',verifyJwt,verifyAdmin, async (req,res) => {
        const users = await userCollection.estimatedDocumentCount();
        const menuItem = await menuCollection.estimatedDocumentCount();
        res.send({
          users,menuItem
        })
      })

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid cart ID format" });
      }

      const result = await cartsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

const maxRetries = 5;
let currentRetry = 0;

async function runWithRetry() {
  while (currentRetry < maxRetries) {
    try {
      await run();
      break;
    } catch (error) {
      currentRetry++;
      console.error(`Attempt ${currentRetry} failed:`, error);
      if (currentRetry >= maxRetries) {
        console.error("Maximum retry attempts reached. Exiting...");
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
}

runWithRetry();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
