// Type-safe button that defaults to type="button" to prevent accidental form submissions
import { Button, type ButtonProps } from "@/components/ui/button";

// Defaults to type="button" unless caller overrides to "submit" or "reset"
export function SafeButton(props: ButtonProps & { type?: "button" | "submit" | "reset" }) {
  const { type = "button", ...rest } = props;
  return <Button type={type} {...rest} />;
}