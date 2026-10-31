import { writeFileSync } from "node:fs";
import { z } from "zod";
import { projectSchema } from "../apps/web/src/domain";
writeFileSync(
  "contracts/project-v1.schema.json",
  JSON.stringify(
    z.toJSONSchema(projectSchema, { target: "draft-7", io: "input" }),
    null,
    2,
  ) + "\n",
);
