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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: MIGRATION_1,
        kind: MigrationKind::Up,
    }];

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
