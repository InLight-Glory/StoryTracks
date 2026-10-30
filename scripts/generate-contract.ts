import { writeFileSync } from "node:fs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { projectSchema } from "../apps/web/src/domain";
writeFileSync(
  "contracts/project-v1.schema.json",
  JSON.stringify(
    zodToJsonSchema(projectSchema, "StoryTracksProject"),
    null,
    2,
  ) + "\n",
);
