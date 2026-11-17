/*
  Spirit Island companions: site settings
  ---------------------------------------
  Leave everything empty to save progress in each browser (works offline,
  one device per campaign).

  To share a campaign live between several phones, create a free Supabase
  project, run the SQL from README.md, then paste your project's URL and
  "anon public" key below. Pick a long, hard-to-guess campaignCode: everyone
  who opens the site with this config shares the same campaigns.
*/
window.COMPANION_CONFIG = {
  supabaseUrl: "",        // e.g. "https://abcdefghij.supabase.co"
  supabaseAnonKey: "",    // the "anon public" key from Project Settings → API
  campaignCode: ""        // e.g. "benjamin-spirit-island-7f3k9q"
};
