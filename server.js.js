import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import helmet from "helmet";

const app = express();

// ===== SECURITY =====
app.use(express.json());
app.use(cors());
app.use(helmet());

// ===== DATABASE =====
mongoose.connect("mongodb+srv://electromarket2102_db_user:1234abcd@cluster0.pa4ui1l.mongodb.net/?appName=Cluster0")
.then(async () => {
  console.log("Connesso a MongoDB");

  await Product.insertMany([
    { name: "Prodotto A", price: 10 },
    { name: "Prodotto B", price: 20 },
    { name: "Prodotto C", price: 30 }
  ]);

  console.log("Prodotti inseriti!");

  app.listen(3000, () => {
    console.log("Server su http://localhost:3000");
  });
})
.catch(err => console.log(err));

// ===== MODELS =====
const User = mongoose.model("User", new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
}));

const Product = mongoose.model("Product", new mongoose.Schema({
  name: String,
  price: Number
}));

// ===== AUTH MIDDLEWARE =====
const auth = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const verified = jwt.verify(token, "SUPER_SECRET_KEY");
    req.user = verified;
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
};

// ===== REGISTER =====
app.post("/register", async (req, res) => {
  try {
    if (!req.body.username || !req.body.password)
      return res.status(400).json({ error: "Missing data" });

    const hashed = await bcrypt.hash(req.body.password, 10);

    const user = new User({
      username: req.body.username,
      password: hashed
    });

    await user.save();
    res.json({ message: "User created" });

  } catch {
    res.status(400).json({ error: "User exists" });
  }
});

// ===== LOGIN =====
app.post("/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username });

  if (!user) return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(req.body.password, user.password);

  if (!valid) return res.status(400).json({ error: "Wrong password" });

  const token = jwt.sign(
    { id: user._id },
    "SUPER_SECRET_KEY",
    { expiresIn: "1h" }
  );

  res.json({ token });
});

// ===== PRODUCTS =====
app.get("/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.get("/", (req, res) => {
res.send("Server funzionante🚀")
});

// ===== ADD PRODUCT (PROTECTED) =====
app.post("/products", auth, async (req, res) => {
  const product = new Product({
    name: req.body.name,
    price: req.body.price
  });

  await product.save();
  res.json(product);
});

// ===== PROFILE =====
app.get("/profile", auth, (req, res) => {
  res.json({ message: "Authorized", user: req.user });
});

// ===== SERVER =====
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
