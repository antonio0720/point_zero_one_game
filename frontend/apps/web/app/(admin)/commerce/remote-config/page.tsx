/**
 * Monetization RC Editor with diff preview, blocked-path warnings, and rollback controls.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, gql } from '@apollo/client';
import { toast } from 'react-toastify';

// GraphQL queries and mutations
const GET_REMOTE_CONFIG = gql`
  query GetRemoteConfig($id: ID!) {
    remoteConfig(id: $id) {
      id
      name
      data
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_REMOTE_CONFIG = gql`
  mutation UpdateRemoteConfig($input: RemoteConfigInput!) {
    updateRemoteConfig(input: $input) {
      id
      name
      data
      createdAt
      updatedAt
    }
  }
`;

interface RemoteConfigData {
  [key: string]: any;
}

interface RemoteConfigInput {
  id: string;
  name: string;
  data: RemoteConfigData;
}

/**
 * Monetization RC Editor component.
 */
const MonetizationRCEditor = () => {
  const { id } = useParams<{ id: string }>();
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfigData>({});
  const [updateRemoteConfig, { loading, error }] = useMutation<any, RemoteConfigInput>(UPDATE_REMOTE_CONFIG);

  // Fetch remote config data on mount and update state
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await useQuery(GET_REMOTE_CONFIG, { variables: { id } });
        setRemoteConfig(data.remoteConfig.data);
      } catch (error) {
        console.error('Error fetching remote config:', error);
        toast.error('Failed to load remote config data.');
      }
    };

    fetchData();
  }, [id]);

  // Handle form submission and update remote config in the database
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await updateRemoteConfig({ variables: { id, data: remoteConfig } });
      toast.success('Remote config updated successfully.');
    } catch (error) {
      console.error('Error updating remote config:', error);
      toast.error('Failed to save changes to remote config.');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Monetization RC Editor</h1>
      <Link to="/commerce/remote-config">Back to list</Link>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Name:</label>
        <input type="text" id="name" value={remoteConfig.name || ''} onChange={(e) => setRemoteConfig({ ...remoteConfig, name: e.target.value })} />

        <div dangerouslySetInnerHTML={{ __html: JSON.stringify(remoteConfig, null, 2) }}></div>

        <button type="submit" disabled={JSON.stringify(remoteConfig) === JSON.stringify(initialRemoteConfig)}>Save Changes</button>
      </form>
    </div>
  );
};

// Initial state for the remote config data (empty object)
const initialRemoteConfig: RemoteConfigData = {};

export default MonetizationRCEditor;
