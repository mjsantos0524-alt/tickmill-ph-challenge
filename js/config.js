// Supabase project: tickmill-ph-challenge (demo/prototype data only)
const SUPABASE_URL = "https://xttgzchkdlenkzoiratf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dGd6Y2hrZGxlbmt6b2lyYXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3ODU0NTksImV4cCI6MjEwMjM2MTQ1OX0.mUGLQ0px6eYWEq5bEK723Pfcp0ppMTzaZFbuLkMR98k";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Campaign window: 90-day quarterly cycle, demo assumes launch = today.
const CAMPAIGN_LAUNCH = new Date();
const CAMPAIGN_END = new Date(CAMPAIGN_LAUNCH.getTime() + 90 * 24 * 60 * 60 * 1000);
