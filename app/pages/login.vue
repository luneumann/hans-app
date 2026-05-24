<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="w-full max-w-sm space-y-6">
      <h1 class="text-2xl font-bold text-center">Sign in to HANS</h1>

      <div v-if="sent" class="text-center text-sm text-gray-600">
        Check your email for a magic link.
      </div>

      <form v-else class="space-y-4" @submit.prevent="sendMagicLink">
        <UInput
          v-model="email"
          type="email"
          placeholder="you@example.com"
          required
          :disabled="loading"
        />
        <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>
        <UButton type="submit" block :loading="loading">
          Send Magic Link
        </UButton>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const errorMsg = ref('')

async function sendMagicLink() {
  loading.value = true
  errorMsg.value = ''
  const { error } = await supabase.auth.signInWithOtp({
    email: email.value,
    options: { emailRedirectTo: `${window.location.origin}/confirm` },
  })
  loading.value = false
  if (error) {
    errorMsg.value = 'Diese E-Mail-Adresse ist nicht zugelassen.'
  } else {
    sent.value = true
  }
}
</script>
