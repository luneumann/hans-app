<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="w-full max-w-sm space-y-6">
      <h1 class="text-2xl font-bold text-center">Sign in to HANS</h1>

      <form class="space-y-4" @submit.prevent="signIn">
        <UInput
          v-model="email"
          type="email"
          placeholder="E-Mail"
          required
          :disabled="loading"
        />
        <UInput
          v-model="password"
          type="password"
          placeholder="Passwort"
          required
          :disabled="loading"
        />
        <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>
        <UButton type="submit" block :loading="loading">
          Anmelden
        </UButton>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function signIn() {
  loading.value = true
  errorMsg.value = ''
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (error) {
    errorMsg.value = 'E-Mail oder Passwort falsch.'
  } else {
    router.push('/')
  }
}
</script>
