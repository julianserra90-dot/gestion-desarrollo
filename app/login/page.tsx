import { iniciarSesion } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={page}>
      <form action={iniciarSesion} style={panel}>
        <p style={eyebrow}>Gestión de desarrollo</p>
        <h1 style={title}>Ingresar</h1>
        <p style={subtitle}>Accedé para ver el estado de las obras.</p>

        {error && <p style={errorBox}>{error}</p>}

        <label style={field}>
          <span style={label}>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            style={input}
          />
        </label>

        <label style={field}>
          <span style={label}>Contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            style={input}
          />
        </label>

        <button type="submit" style={button}>
          Ingresar
        </button>
      </form>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "#ffffff",
  color: "#111111",
  fontFamily: "Arial, Helvetica, sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
};

const panel = {
  border: "1px solid rgba(17, 17, 17, 0.06)",
  borderRadius: "18px",
  boxShadow:
    "0 1px 2px rgba(17, 17, 17, 0.04), 0 12px 28px -14px rgba(17, 17, 17, 0.16)",
  padding: "40px",
  width: "100%",
  maxWidth: "400px",
  display: "grid",
  gap: "20px",
};

const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

const title = {
  fontSize: "32px",
  fontWeight: 500,
  letterSpacing: "-0.01em",
  margin: 0,
};

const subtitle = {
  color: "#666666",
  margin: 0,
  fontSize: "15px",
};

const errorBox = {
  border: "1px solid #111111",
  borderRadius: "10px",
  padding: "12px",
  margin: 0,
  fontSize: "14px",
};

const field = {
  display: "grid",
  gap: "8px",
};

const label = {
  fontSize: "13px",
  color: "#555555",
};

const input = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  borderRadius: "10px",
  background: "#ffffff",
  padding: "12px",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111111",
};

const button = {
  background: "#111111",
  color: "#ffffff",
  border: "none",
  borderRadius: "10px",
  padding: "14px 20px",
  fontSize: "14px",
  cursor: "pointer",
  marginTop: "4px",
};
