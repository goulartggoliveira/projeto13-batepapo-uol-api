import cors from "cors";
import express from "express";
import { MongoClient } from "mongodb";
import joi from "joi";
import dotenv from "dotenv";
import dayjs from "dayjs";

const app = express();

app.use(cors());
app.use(express.json());
dotenv.config();


// Components
const participantSchema = joi.object({
  name: joi.string().required().min(3),
});
const mongoClient = new MongoClient(process.env.DATABASE_URL);
try {
  await mongoClient.connect();
  console.log("mongo conected");
} catch (err) {
  console.log(err);
}

const db = mongoClient.db();
const participantsCollection = db.collection("participants");
const messagesCollection = db.collection("messages");

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const { error } = participantSchema.validate({ name }, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const participantExists = await participantsCollection.findOne({ name });
    if (participantExists) {
      return res.sendStatus(409);
    }

    await participantsCollection.insertOne({ name, lastStatus: Date.now() });

    await messagesCollection.insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
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

app.listen(5000, () => console.log("rodando perfeitamente 5000"));