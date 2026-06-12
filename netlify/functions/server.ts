import { createRequestHandler } from "@react-router/node";

// @ts-expect-error - server build produced by `npm run build`
import * as build from "../../build/server/index.js";

export default createRequestHandler(build);
