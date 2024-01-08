import cors from "cors";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
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

      const participant = await db.collection("participants").findOne({ name: user })
      if (!participant) return res.sendStatus(422)

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
    const {limit} = req.query;
    const { user } = req.headers;
    const numberLimit = Number(limit)

    if (limit === undefined && (numberLimit <= 0 || isNaN(numberLimit))) return res.sendStatus(422)

    try {
      const messages = await messagesCollection
        .find({
          $or: [{ from: user }, { to: { $in: [user, "Todos"] } }, { type: "message" }] })
        .sort(({ $natural: -1 }))
        .limit(limit === undefined ? 0 : numberLimit)
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

app.post("/status", async (req, res) => {
    const { user } = req.headers;

    try {
      const participantExists = await participantsCollection.findOne({
        name: user,
      });

      if (!participantExists) {
        return res.sendStatus(404);
      }

      await participantsCollection.updateOne(
        {
          name: user,
        },
        { $set: { lastStatus: Date.now() } }
      );

      res.sendStatus(200);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
});

app.delete("/messages/:id", async (req, res) => {
  const { user } = req.headers
  const { id } = req.params

  try {
      const message = await db.collection("messages").findOne({ _id: new ObjectId(id) })
      if (!message) return res.sendStatus(404)
      if (message.from !== user) return res.sendStatus(401)

      await db.collection("messages").deleteOne({ _id: new ObjectId(id) })
      res.sendStatus(200)

  } catch (err) {
      res.status(500).send(err.message)
  }
})

setInterval(async () => {
    console.log("removido");
  
    const tenSecondsago = Date.now() - 10000;
  
    try {
      const inactives = await participantsCollection
        .find({ lastStatus: { $lte: tenSecondsago } })
        .toArray();
  
      if (inactives.length > 0) {
        const inactivesMessages = inactives.map((participant) => {
          return {
            from: participant.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss"),
          };
        });
  
        await messagesCollection.insertMany(inactivesMessages);
        await participantsCollection.deleteMany({
          lastStatus: { $lte: tenSecondsago },
        });
      }
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
}, 15000);

app.listen(5000, () => console.log("rodando perfeitamente 5000"));

