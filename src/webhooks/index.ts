import { Hono } from "hono";
import { HonoContextEnv } from "../../types";

const webhookApp = new Hono<HonoContextEnv>();