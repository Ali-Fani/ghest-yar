use tauri::{Manager, WebviewWindow};
use tauri_plugin_sql::{Migration, MigrationKind};

const MIGRATION_1: &str = r#"
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('payable','receivable')),
  counterparty TEXT,
  category TEXT,
  total_amount INTEGER NOT NULL,
  down_payment INTEGER NOT NULL DEFAULT 0,
  profit_rate REAL NOT NULL DEFAULT 0,
  installment_count INTEGER NOT NULL,
  installment_amount INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  interval_type TEXT NOT NULL CHECK(interval_type IN ('monthly','weekly','days')),
  interval_value INTEGER NOT NULL DEFAULT 1,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS installments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  paid_date TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_inst_plan ON installments(plan_id);
CREATE INDEX IF NOT EXISTS idx_inst_due ON installments(due_date);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
"#;

// v1.2: providers, split purchases and monthly statements.
// Append-only: MIGRATION_1 above is untouched (already applied on users' machines).
const MIGRATION_2: &str = r#"
CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  credit_limit INTEGER,
  supports_split INTEGER NOT NULL DEFAULT 1,
  supports_statement INTEGER NOT NULL DEFAULT 0,
  preset_parts INTEGER NOT NULL DEFAULT 4,
  preset_interval_type TEXT NOT NULL DEFAULT 'monthly',
  preset_interval_value INTEGER NOT NULL DEFAULT 1,
  preset_first_at_purchase INTEGER NOT NULL DEFAULT 1,
  preset_fee_type TEXT NOT NULL DEFAULT 'none',
  preset_fee_value REAL NOT NULL DEFAULT 0,
  statement_close_day INTEGER,
  statement_due_offset INTEGER,
  statement_fee_type TEXT NOT NULL DEFAULT 'none',
  statement_fee_value REAL NOT NULL DEFAULT 0,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE plans ADD COLUMN kind TEXT NOT NULL DEFAULT 'loan';
ALTER TABLE plans ADD COLUMN provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL;
ALTER TABLE plans ADD COLUMN store TEXT;
ALTER TABLE plans ADD COLUMN purchase_date TEXT;
ALTER TABLE plans ADD COLUMN fee_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE plans ADD COLUMN fee_value REAL NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  store TEXT,
  title TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  due_date TEXT NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  paid_date TEXT,
  split_plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  note TEXT,
  UNIQUE(provider_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_plans_provider ON plans(provider_id);
CREATE INDEX IF NOT EXISTS idx_charges_provider ON charges(provider_id, date);
CREATE INDEX IF NOT EXISTS idx_statements_provider ON statements(provider_id);
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // IMPORTANT: migrations are versioned and APPEND-ONLY. Never edit an existing
    // migration (it is already applied on users' machines); add a new one with the
    // next `version` number instead, so installer upgrades keep user data.
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: MIGRATION_1,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "providers_charges_statements",
            sql: MIGRATION_2,
            kind: MigrationKind::Up,
        },
    ];

    let mut builder = tauri::Builder::default();

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let w: WebviewWindow = w;
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }));
    }

    builder
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:ghestyar.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
