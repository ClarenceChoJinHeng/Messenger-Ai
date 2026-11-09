import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Laragon's MySQL on Windows ignores capital letters in table names and reports them lowercase,
// so `prisma migrate dev` can write `user` where the table is really `User`.
// On Linux (the hosted database) those are DIFFERENT tables, and the deploy failed with
// "Table 'defaultdb.user' doesn't exist". This test catches it before it reaches the server.
const root = join(process.cwd(), 'prisma');
const models = [...readFileSync(join(root, 'schema.prisma'), 'utf8').matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);

describe('migrations use the exact table names from schema.prisma', () => {
  const dirs = readdirSync(join(root, 'migrations'), { withFileTypes: true }).filter((d) => d.isDirectory());

  it.each(dirs.map((d) => d.name))('%s', (dir) => {
    const sql = readFileSync(join(root, 'migrations', dir, 'migration.sql'), 'utf8');
    const wrong: string[] = [];
    for (const model of models) {
      // `user` (or any other spelling) after TABLE / REFERENCES / INTO / ON, when the model is `User`
      const pattern = new RegExp(`\\b(TABLE|REFERENCES|INTO|ON)\\s+\`(${model})\``, 'gi');
      for (const match of sql.matchAll(pattern)) {
        if (match[2] !== model) wrong.push(`\`${match[2]}\` should be \`${model}\``);
      }
    }
    expect(wrong, `Fix the table names in prisma/migrations/${dir}/migration.sql`).toEqual([]);
  });
});
