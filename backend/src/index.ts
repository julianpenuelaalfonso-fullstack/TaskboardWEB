import { createApp } from "./app.js";
import { env } from "./env.js";

createApp().listen(env.PORT, () => {
  console.log(`API escuchando en el puerto ${env.PORT}`);
});
