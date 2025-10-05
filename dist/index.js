"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("./routes/auth");
const tickets_1 = require("./routes/tickets");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use("*", (0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use("/api/auth", auth_1.authRouter);
app.use("/api/tickets", tickets_1.ticketRouter);
app.listen(8000, () => console.log("Server running on http://localhost:8000"));
