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

const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required().min(1),
    text: joi.string().required().min(1),
    type: joi.string().required().valid("message", "private_message"),
    time: joi.string(),
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

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;

    const message = {
      from: user,
      to,
      text,
      type,
      time: dayjs().format("HH:mm:ss"),
    };

    try {
      const { error } = messageSchema.validate(message, { abortEarly: false });

      if (error) {
        const errors = error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
      }
      await messagesCollection.insertOne(message);

      res.sendStatus(201);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    const limit = Number(req.query.limit);
    const { user } = req.headers;

    try {
      const messages = await messagesCollection
        .find({
          $or: [
            { from: user },
            { to: { $in: [user, "Todos"] } },
            { type: "message" },
          ],
        })
        .limit(limit)
        .toArray();

      if (messages.length === 0) {
        return res.status(422).send("Limite com valor inválido");
      }

      res.send(messages);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
});

app.listen(5000, () => console.log("rodando perfeitamente 5000"));

