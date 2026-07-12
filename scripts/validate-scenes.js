import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true });

const schema = JSON.parse(
  fs.readFileSync("./scripts/scene.schema.json", "utf8")
);

const validate = ajv.compile(schema);

const dir = "./scenes";

let failed = false;

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".json"))
    continue;

  const full = path.join(dir, file);
  const scene = JSON.parse(fs.readFileSync(full, "utf8"));

  if (!validate(scene)) {
    failed = true;
    console.error(`\n❌ ${file}`);
    console.error(validate.errors);
  } else {
    console.log(`✅ ${file}`);
  }
}

if (failed)
  process.exit(1);