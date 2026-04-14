// Sets REPETIT_DB before any core module loads, so connection.ts uses :memory:
process.env.REPETIT_DB = ":memory:";
