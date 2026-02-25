/**
 * Seed script — populates the database with a demo user, two boards, columns, and tasks.
 *
 * Usage:
 *   npx prisma db seed
 *   # or directly:
 *   npx ts-node --transpile-only prisma/seed.ts
 *
 * The demo user is created with a placeholder Auth0 sub. To log in as this user:
 *   1. In Auth0 dashboard, find or create a user and note their User ID (e.g. auth0|abc123).
 *   2. Update DEMO_AUTH0_SUB below (or set the SEED_AUTH0_SUB env var) to match.
 *   3. Re-run the seed: npx prisma db seed
 *
 * Running the seed multiple times is safe — the user upsert is idempotent and existing
 * boards/columns/tasks are not duplicated (boards are identified by name + owner).
 */

import { PrismaClient, Priority, Role } from "@prisma/client";

const prisma = new PrismaClient();

const POSITION_GAP = 1024n;

const DEMO_AUTH0_SUB = process.env.SEED_AUTH0_SUB ?? "auth0|seed-demo-user-01";
const DEMO_EMAIL = process.env.SEED_EMAIL ?? "demo@example.com";

interface SeedTask {
  title: string;
  description?: string;
  assigneeName?: string;
  priority: Priority;
}

interface SeedColumn {
  title: string;
  tasks: SeedTask[];
}

interface SeedBoard {
  name: string;
  description?: string;
  columns: SeedColumn[];
}

const BOARDS: SeedBoard[] = [
  {
    name: "Product Roadmap",
    description: "Feature planning and delivery tracking.",
    columns: [
      {
        title: "Backlog",
        tasks: [
          {
            title: "Define OKRs for next quarter",
            description: "Align with leadership on measurable outcomes and key results.",
            priority: Priority.HIGH,
          },
          {
            title: "Research competitor pricing",
            priority: Priority.MEDIUM,
          },
          {
            title: "Write onboarding copy for new users",
            priority: Priority.LOW,
          },
        ],
      },
      {
        title: "In Progress",
        tasks: [
          {
            title: "Implement task drag-and-drop",
            description:
              "Use dnd-kit with gap-based BIGINT ordering and optimistic cache updates.",
            assigneeName: "Alex",
            priority: Priority.HIGH,
          },
          {
            title: "Auth0 PKCE integration",
            description:
              "SPA Authorization Code + PKCE flow with JWKS validation on the API.",
            assigneeName: "Sam",
            priority: Priority.HIGH,
          },
        ],
      },
      {
        title: "Done",
        tasks: [
          {
            title: "Set up Fastify project scaffold",
            assigneeName: "Sam",
            priority: Priority.LOW,
          },
          {
            title: "Configure Prisma schema and initial migration",
            description: "Board, Column, Task, and User models with FK constraints and indexes.",
            priority: Priority.MEDIUM,
          },
          {
            title: "Write multi-stage Dockerfiles",
            description: "API: Node 20 + Prisma generate. Web: Vite build + Nginx runtime.",
            assigneeName: "Alex",
            priority: Priority.MEDIUM,
          },
        ],
      },
    ],
  },
  {
    name: "Bug Tracker",
    description: "Open issues and regression fixes.",
    columns: [
      {
        title: "Reported",
        tasks: [
          {
            title: "Fix token refresh on tab focus",
            description:
              "Auth0 SDK does not refresh silently when tab regains focus with localstorage cache.",
            assigneeName: "Alex",
            priority: Priority.HIGH,
          },
          {
            title: "Column reorder drops to wrong position",
            description:
              "Midpoint calculation overflows when adjacent positions differ by 1.",
            priority: Priority.MEDIUM,
          },
        ],
      },
      {
        title: "In Review",
        tasks: [
          {
            title: "Postgres PVC not retained on pod restart",
            description:
              "StatefulSet volumeClaimTemplate must use a storage class with Retain reclaim policy.",
            assigneeName: "Sam",
            priority: Priority.HIGH,
          },
        ],
      },
      {
        title: "Resolved",
        tasks: [
          {
            title: "CORS rejected on OPTIONS preflight",
            description: "Fixed by registering @fastify/cors with allowedOrigins from env.",
            priority: Priority.LOW,
          },
          {
            title: "Admin stats query missing LEFT JOIN",
            description: "Users with zero boards were excluded from the top-10 ranking.",
            assigneeName: "Alex",
            priority: Priority.MEDIUM,
          },
        ],
      },
    ],
  },
];

async function main(): Promise<void> {
  console.log("Seeding database…");

  const user = await prisma.user.upsert({
    where: { auth0Sub: DEMO_AUTH0_SUB },
    update: { email: DEMO_EMAIL },
    create: {
      auth0Sub: DEMO_AUTH0_SUB,
      email: DEMO_EMAIL,
      role: Role.user,
    },
  });

  console.log(`  User: ${user.email} (${user.auth0Sub})`);

  for (let bi = 0; bi < BOARDS.length; bi++) {
    const bd = BOARDS[bi];

    const existing = await prisma.board.findFirst({
      where: { ownerUserId: user.id, name: bd.name },
      select: { id: true },
    });

    if (existing) {
      console.log(`  Board "${bd.name}" already exists — skipping.`);
      continue;
    }

    const board = await prisma.board.create({
      data: {
        ownerUserId: user.id,
        name: bd.name,
        description: bd.description ?? null,
        position: POSITION_GAP * BigInt(bi + 1),
      },
    });

    let totalTasks = 0;

    for (let ci = 0; ci < bd.columns.length; ci++) {
      const cd = bd.columns[ci];

      const column = await prisma.column.create({
        data: {
          boardId: board.id,
          title: cd.title,
          position: POSITION_GAP * BigInt(ci + 1),
        },
      });

      for (let ti = 0; ti < cd.tasks.length; ti++) {
        const td = cd.tasks[ti];

        await prisma.task.create({
          data: {
            columnId: column.id,
            title: td.title,
            description: td.description ?? null,
            assigneeName: td.assigneeName ?? null,
            priority: td.priority,
            position: POSITION_GAP * BigInt(ti + 1),
          },
        });

        totalTasks++;
      }
    }

    console.log(
      `  Board "${board.name}": ${bd.columns.length} columns, ${totalTasks} tasks.`,
    );
  }

  console.log("Done.");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
