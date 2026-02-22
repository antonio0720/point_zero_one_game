/**
 * Cohort Management UI Component
 */

import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, gql } from '@apollo/client';

// GraphQL queries
const GET_COHORT = gql`
  query GetCohort($id: ID!) {
    cohort(id: $id) {
      id
      name
      members {
        id
        username
        role
      }
      roles {
        id
        name
      }
      assignments {
        memberId
        roleId
      }
    }
  }
`;

const GET_MEMBER = gql`
  query GetMember($id: ID!) {
    member(id: $id) {
      id
      username
    }
  }
`;

const GET_ROLE = gql`
  query GetRole($id: ID!) {
    role(id: $id) {
      id
      name
    }
  }
`;

interface CohortData {
  id: string;
  name: string;
  members: Member[];
  roles: Role[];
  assignments: Assignment[];
}

interface Member {
  id: string;
  username: string;
  role: Role | null;
}

interface Role {
  id: string;
  name: string;
}

interface Assignment {
  memberId: string;
  roleId: string;
}

const CohortPage: React.FC = () => {
  const { cohortSlug } = useParams<{ cohortSlug: string }>();
  const { loading, error, data } = useQuery<CohortData>(GET_COHORT, { variables: { id: cohortSlug } });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error :(</div>;

  const [members, setMembers] = useState<Member[]>(data.cohort.members.map((member) => ({ ...member, role: null })));
  const [roles, setRoles] = useState<Role[]>(data.cohort.roles);
  const [assignments, setAssignments] = useState<Assignment[]>(data.cohort.assignments);

  useEffect(() => {
    setMembers(data.cohort.members.map((member) => ({ ...member, role: roles.find((role) => member.roleId === role.id) })));
  }, [roles]);

  const handleRoleChange = (memberId: string, newRoleId: string) => {
    // Update the assignment in state and send a mutation to update it in the database
  };

  return (
    <div>
      <h1>{data.cohort.name}</h1>
      <ul>
        {members.map((member) => (
          <li key={member.id}>
            {member.username} ({member.role?.name || 'None'})
            <select onChange={(e) => handleRoleChange(member.id, e.target.value)}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <Link to={`/org/${cohortSlug}/members`}>Add Member</Link>
    </div>
  );
};

export default CohortPage;
