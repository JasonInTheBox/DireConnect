process.env.PORT ??= "4000";

process.env.CLIENT_URL ??= "http://localhost:3000";

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/postgres";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_JWT_SECRET ??= "fake-jwt-secret";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "fake-jwt-secret";

process.env.REDIS_URL ??= "redis://localhost:6379";

process.env.MESSAGE_MODE = "fake";
process.env.APP_URL ??= "http://localhost:4000";
process.env.AWS_REGION ??= "us-west-1";

process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "fake-anon-key";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "fake-publishable-key";
