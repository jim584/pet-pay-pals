Add a show/hide password toggle to the Auth page (`src/pages/Auth.tsx`) for both sign-in and sign-up.

- Add local `showPassword` state.
- Wrap the password `Input` in a relative container with an eye/eye-off icon button on the right (lucide `Eye` / `EyeOff`).
- Toggle input `type` between `"password"` and `"text"`.
- Button is `type="button"`, ghost styled, with `aria-label` ("Show password" / "Hide password") for accessibility. Add right padding to the input so text doesn't overlap the icon.
- No backend or business-logic changes.