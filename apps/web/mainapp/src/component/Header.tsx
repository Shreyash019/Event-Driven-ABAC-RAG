import { AppContainer, Logo, ThemeToggle } from "@arac/ui";

export default function Header() {
  return (
    <AppContainer>
      <div className="p-2 flex items-center gap-4">
        <Logo
          size={48}
          src="https://res.cloudinary.com/dw58hubkc/image/upload/v1782546357/Screenshot_2026-06-27_at_1.15.24_PM_tlynbm.png"
          className="rounded-full"
        />
        <p>
          Microfrontend host. RAG / LLM / AI lives in a separate zone (ragapp).
        </p>
        <ThemeToggle />
      </div>
    </AppContainer>
  );
}
