'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'

export type CustomerResult = { ok: true; message: string } | { ok: false; error: string }

export type CustomerForm = {
  NAME: string
  firstName: string
  lastName: string
  company: string
  EMAIL: string
  PHONE01: string
  AFM: string
  IRSDATA: string
  JOBTYPETRD: string
  ADDRESS: string
  ZIP: string
  CITY: string
  DISTRICT: string
  COUNTRY: string
  REMARKS: string
  ISACTIVE: boolean
}

/**
 * Local-only edit.
 *
 * Nothing is pushed to WooCommerce, and that is deliberate rather than
 * unfinished: guests have no upstream account to update, and for registered
 * customers the billing address on file is the one they typed at checkout.
 * Overwriting it from here would silently change what appears on their next
 * order. The fields kept beyond WooCommerce's own — ΑΦΜ, ΔΟΥ, επάγγελμα — exist
 * for invoicing and have no upstream counterpart at all.
 */
export async function saveCustomer(id: string, form: CustomerForm): Promise<CustomerResult> {
  await requirePermission('customer.edit')

  if (!form.NAME.trim()) return { ok: false, error: 'Το όνομα δεν μπορεί να είναι κενό.' }

  const email = form.EMAIL.trim().toLowerCase()
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Μη έγκυρο email.' }
  }

  const afm = form.AFM.replace(/\D/g, '')
  if (afm && afm.length !== 9) {
    return { ok: false, error: 'Το ΑΦΜ πρέπει να έχει 9 ψηφία.' }
  }

  if (email) {
    const clash = await prisma.customer.findFirst({
      where: { EMAIL: email, NOT: { id } },
      select: { id: true, NAME: true },
    })
    if (clash) {
      return { ok: false, error: `Το email ανήκει ήδη στον πελάτη «${clash.NAME}».` }
    }
  }

  await prisma.customer.update({
    where: { id },
    data: {
      NAME: form.NAME.trim(),
      firstName: form.firstName.trim() || null,
      lastName: form.lastName.trim() || null,
      company: form.company.trim() || null,
      EMAIL: email || null,
      PHONE01: form.PHONE01.trim() || null,
      AFM: afm || null,
      IRSDATA: form.IRSDATA.trim() || null,
      JOBTYPETRD: form.JOBTYPETRD.trim() || null,
      ADDRESS: form.ADDRESS.trim() || null,
      ZIP: form.ZIP.trim() || null,
      CITY: form.CITY.trim() || null,
      DISTRICT: form.DISTRICT.trim() || null,
      COUNTRY: form.COUNTRY.trim().toUpperCase() || null,
      REMARKS: form.REMARKS.trim() || null,
      ISACTIVE: form.ISACTIVE ? 1 : 0,
    },
  })

  revalidatePath(`/customers/${id}`)
  revalidatePath('/customers')
  return { ok: true, message: 'Ο πελάτης αποθηκεύτηκε τοπικά. Δεν στάλθηκε στο WooCommerce.' }
}
