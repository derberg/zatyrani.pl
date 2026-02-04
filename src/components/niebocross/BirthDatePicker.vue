<script setup>
import { ref, watch } from 'vue';
import { VueDatePicker } from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';

const props = defineProps({
  participantIndex: {
    type: Number,
    required: true
  },
  label: {
    type: String,
    default: 'Birth Date'
  }
});

const emit = defineEmits(['update:birthDate']);

const date = ref(null);

// Watch for date changes and emit the formatted date
watch(date, (newDate) => {
  if (newDate) {
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    emit('update:birthDate', { day, month, year });
  } else {
    emit('update:birthDate', { day: '', month: '', year: '' });
  }
});
</script>

<template>
  <div>
    <label class="block text-sm font-semibold text-slate-700">
      {{ label }} <span class="text-red-600">*</span>
    </label>
    <VueDatePicker
      v-model="date"
      :max-date="new Date()"
      :year-range="[1925, new Date().getFullYear()]"
      auto-apply
      :enable-time-picker="false"
      format="dd/MM/yyyy"
      placeholder="Select date"
      :class="'mt-1'"
      input-class-name="block w-full rounded-lg border-emerald-300 border-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-3 py-2"
    />
  </div>
</template>

<style>
/* Customize Vue3DatePicker to match Tailwind theme */
.dp__input {
  @apply block w-full rounded-lg border-emerald-300 border-2 shadow-sm px-3 py-2;
}

.dp__input:focus {
  @apply border-emerald-500 ring-emerald-500;
}

.dp__theme_light {
  --dp-primary-color: #059669;
  --dp-primary-text-color: #ffffff;
  --dp-hover-color: #d1fae5;
  --dp-hover-text-color: #064e3b;
  --dp-border-color: #a7f3d0;
  --dp-menu-border-color: #a7f3d0;
}
</style>
