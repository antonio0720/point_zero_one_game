/**
 * Run Page for Public Explorer by Run ID
 */

import React, { useEffect } from 'react';
import { Link, RouteComponentProps } from '@reach/router';
import { API_URL } from '../../constants';
import LoadingSpinner from '../LoadingSpinner';
import ConversionCTA from '../ConversionCTA';
import FastScanLayout from '../FastScanLayout';

interface Params {
  runId: string;
}

interface Data {
  id: number;
  name: string;
  description: string;
  // ... (other fields as per Run schema)
}

interface Props extends RouteComponentProps<Params> {}

const RunPage: React.FC<Props> = ({ params }) => {
  const [data, setData] = React.useState<Data | null>(null);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_URL}/runs/${params.runId}`);
        const json = await response.json();
        setData(json);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching run data:', error);
        setLoading(false);
      }
    };

    if (params.runId) {
      fetchData();
    }
  }, [params.runId]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <div>Run not found</div>;
  }

  return (
    <FastScanLayout>
      <h1>{data.name}</h1>
      <p dangerouslySetInnerHTML={{ __html: data.description }} />
      <ConversionCTA />
      {/* ... (other components as per FastScanLayout schema) */}
    </FastScanLayout>
  );
};

export default RunPage;
