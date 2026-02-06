# Configuración de Edge Function send-message

## Problema
La Edge Function está devolviendo 401 porque Supabase Edge Runtime está bloqueando las peticiones a nivel de gateway.

## Solución

### Opción 1: Dashboard de Supabase (Recomendado)

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Navega a **Edge Functions** en el menú lateral
3. Selecciona la función **send-message**
4. Busca la configuración de **JWT Verification** o **Authentication**
5. **Desactiva** la opción "Verify JWT" o "Require JWT"
   - Nota: Esto es seguro porque nuestra función verifica el JWT internamente en el código

### Opción 2: Supabase CLI (Alternativa)

Si tienes Supabase CLI instalado, puedes desplegar con configuración:

```bash
# Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# Login
supabase login

# Link al proyecto
supabase link --project-ref bjdqjxrwvktfqienbzop

# Deploy con configuración
supabase functions deploy send-message --no-verify-jwt
```

## ¿Por qué es seguro desactivar JWT verification en el gateway?

1. **Verificación interna**: Nuestra función verifica el JWT en las líneas 31-51 del código
2. **Service role key**: Usamos el service role key solo después de verificar el usuario
3. **Control de acceso**: Solo usuarios autenticados pueden enviar mensajes

## Verificación

Después de configurar, intenta enviar un mensaje desde el CRM. Deberías ver en los logs:

```
[Auth] Usuario autenticado: [user-id]
[Debug] Buscando lead: [lead-id]
[Debug] Instancia resuelta del último mensaje: [instance-id]
```

Si ves estos logs, la función está funcionando correctamente.
