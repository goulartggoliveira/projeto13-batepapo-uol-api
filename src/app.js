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

const messageSchema = joi.object({
  from: joi.string().required(),
  to: joi.string().required().min(2),
  text: joi.string().required().min(1),
  type: joi.string().required().valid("message", "private_message"),
  time: joi.string(),
});

const mongoClient = new MongoClient(process.env.DATABASE_URL);
const PORT = process.env.PORT || 5000;
try {
  await mongoClient.connect();
  console.log("Connected to Mongo");
} catch (error) {
  console.log(err);
}

const db = mongoClient.db("bateuol");
const participants = db.collection("participants");
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
    const participantsExists = await participants.findOne({ name });
    if (participantsExists) {
      return res.sendStatus(409);
    }

    await participants.insertOne({ name, lastStatus: Date.now() });

    await messagesCollection.insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: 'HH:MM:SS'});

    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participant = await participants.find().toArray();
    if (!participant) {
      res.sendStatus(404);
    }
    res.send(participant);
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
  const { user } = req.headers;
  const limitador = Number(req.query.limit);

  try {
    const messages = await messagesCollection
      .find({
        $or: [
          { from: user },
          { to: { $in: [user, "Todos"] } },
          { type: "message" },
        ],
      })
      .limit(limitador)
      .toArray();

    res.send(messages);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const existParticipants = await participants.findOne({
      name: user,
    });
    if (!existParticipants) {
      return res.sendStatus(404);
    }

    await participants.updateOne(
      { name: user },
      { $set: { lastStatus: Date.now() } }
    );

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

setInterval(async () => {
  console.log("Removidos");

  const tenSeconds = Date.now() - 10000;
  console.log(tenSeconds);

  try {
    const inactive = await participants
      .find({ lastStatus: { $lte: tenSeconds } })
      .toArray();

    if (inactive.length > 0) {
      const inativos = inactive.map((participant) => {
        return {
          from: participant.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        };
      });
      await messagesCollection.insertMany(inativos);
      await participants.deleteMany({
        lastStatus: { lte: tenSeconds },
      });
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
}, 15000);

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));



