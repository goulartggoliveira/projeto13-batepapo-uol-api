import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";
import joi from "joi";
import bcrypt from "bcrypt";
import { v4 as uuidV4 } from "uuid";
import dayjs from "dayjs";
dotenv.config();

const app = express();
app.use(express.json());

const participantsSchema = joi.object({
  name: joi.string().required().min(2),
});

const mongoClient = new MongoClient(process.env.MONGO_URI);

try {
  await mongoClient.connect();
  console.log("Connected to Mongo");
} catch (error) {
  console.log(err);
}

const db = mongoClient.db("bateuol");
const participantsCollection = db.collection("participants");
const messagesCollection = db.collection("messages");

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const { error } = participantsSchema.validate(
    { name },
    { abortEarly: false }
  );

  if (error) {
    const errors = error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const participantsExists = await participantsCollection.findOne({ name });
    if (participantsExists) {
      return res.sendStatus(409);
    }

    await participantsCollection.insertOne({ name, lastStatus: Date.now() });

    await messagesCollection.insertOne({
      from: name,
      to: "Todos",
      text: "entrou na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await participantsCollection.find().toArray();
    if (!participants) {
      res.sendStatus(404);
    }
    res.send(participants);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.listen(5000, () => console.log("Port 5000"));
