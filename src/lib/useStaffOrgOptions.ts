import { useEffect, useState } from 'react'
import { apiCall } from './api'
import { useStaffAuth } from './useStaffAuth'
import type { StaffOrganization } from './types'

// Les tableaux staff cross-organismes (commandes, factures, inscriptions)
// exigent tous un orgId côté backend depuis le split par service — plus
// de vue "tous organismes" par défaut. Un seul fetch de la liste des
// organismes, partagé par ces 3 pages.
export function useStaffOrgOptions() {
  const { staffToken } = useStaffAuth()
  const [orgs, setOrgs] = useState<StaffOrganization[] | null>(null)

  useEffect(() => {
    apiCall<{ data: StaffOrganization[] }>('GET', '/staff/organizations', { staffToken }).then(
      (result) => {
        if (result.ok) setOrgs(result.data.data)
      }
    )
  }, [staffToken])

  return orgs
}
