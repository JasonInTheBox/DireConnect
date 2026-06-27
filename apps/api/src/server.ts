import { apiEnv } from "./config/env.js";
import { app } from "./app.js";

const PORT = apiEnv.port;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
