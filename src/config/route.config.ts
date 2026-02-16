import { Router } from "express";
import currencyRoutes from "../routes/currency.routes";

const v1Router = Router();

// Currency routes
v1Router.use("/currency", currencyRoutes);

export { v1Router };