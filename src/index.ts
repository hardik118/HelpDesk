import express from "express";
import { authRouter } from "./routes/auth";
import { ticketRouter } from "./routes/tickets";
import cors from "cors"

const app = express();

app.use(express.json());
app.use("*", cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use("/api/auth", authRouter);
app.use("/api/tickets", ticketRouter);

app.listen(8000, () => console.log("Server running on http://localhost:8000"));
